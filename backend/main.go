package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"time"

	"github.com/graphql-go/graphql"
	_ "github.com/lib/pq"
)

// ── Types ─────────────────────────────────────────────────────────────────────

type FileMetadata struct {
	CustomerNumber string `json:"customer_number"`
	CustomerType   string `json:"customer_type"`
	FileName       string `json:"file_name"`
	FileCategory   string `json:"file_category"`
	FileCreator    string `json:"file_creator"`
	FileCreatedAt  string `json:"file_created_at"`
	DisposalTime   string `json:"disposal_time"`
	Direction      string `json:"direction"`
}

type JSONData struct {
	Data []FileMetadata `json:"data"`
}

var db *sql.DB

// ── Main ──────────────────────────────────────────────────────────────────────

func main() {
	connStr := getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/file_dashboard?sslmode=disable")

	var err error
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	defer db.Close()

	for i := 0; i < 15; i++ {
		if err = db.Ping(); err == nil {
			break
		}
		log.Printf("waiting for database... (%d/15)", i+1)
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	log.Println("connected to database")

	if err := setupDB(); err != nil {
		log.Fatalf("failed to setup database: %v", err)
	}

	// Aggregator goroutine — starts immediately so the HTTP server is not
	// blocked waiting for the initial catch-up on a large file_metadata table.
	go func() {
		log.Println("aggregator: initial run...")
		runAggregation()
		log.Println("aggregator: initial run complete")

		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			runAggregation()
		}
	}()

	schema, err := buildSchema()
	if err != nil {
		log.Fatalf("failed to build schema: %v", err)
	}

	mux := http.NewServeMux()
	mux.Handle("/graphql", corsMiddleware(graphqlHandler(&schema)))

	log.Println("GraphQL API listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", mux))
}

// ── Database setup ────────────────────────────────────────────────────────────

func setupDB() error {
	// Source table — 2-day retention enforced by pruneRetention()
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS file_metadata (
			id                           SERIAL PRIMARY KEY,
			customer_number              VARCHAR(9),
			customer_type                VARCHAR(10),
			file_name                    VARCHAR(255),
			file_category                VARCHAR(20),
			file_creator                 VARCHAR(6),
			file_created_at              TIMESTAMPTZ,
			disposal_time                VARCHAR(20),
			direction                    VARCHAR(10),
			file_received_at             TIMESTAMPTZ,
			first_analysis_complete_at   TIMESTAMPTZ,
			second_analysis_complete_at  TIMESTAMPTZ,
			first_analysis_result        BOOLEAN
		)
	`)
	if err != nil {
		return fmt.Errorf("create file_metadata: %w", err)
	}
	// Migration guards — safe to run on a table that already has these columns.
	for _, col := range []struct{ name, typ string }{
		{"file_received_at", "TIMESTAMPTZ"},
		{"first_analysis_complete_at", "TIMESTAMPTZ"},
		{"second_analysis_complete_at", "TIMESTAMPTZ"},
		{"first_analysis_result", "BOOLEAN"},
	} {
		db.Exec(fmt.Sprintf("ALTER TABLE file_metadata ADD COLUMN IF NOT EXISTS %s %s", col.name, col.typ))
	}

	// Stats tables — persist beyond the 2-day retention window
	for _, stmt := range []string{
		`CREATE TABLE IF NOT EXISTS stats_totals (
			id          INT PRIMARY KEY DEFAULT 1,
			total_files BIGINT DEFAULT 0,
			last_id     BIGINT DEFAULT 0,
			updated_at  TIMESTAMPTZ DEFAULT NOW()
		)`,
		`INSERT INTO stats_totals (id, total_files, last_id) VALUES (1,0,0) ON CONFLICT DO NOTHING`,
		`CREATE TABLE IF NOT EXISTS stats_by_category (
			file_category VARCHAR(20) PRIMARY KEY,
			count         BIGINT DEFAULT 0,
			updated_at    TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS stats_by_direction (
			direction  VARCHAR(10) PRIMARY KEY,
			count      BIGINT DEFAULT 0,
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS stats_by_customer_type (
			customer_type VARCHAR(10) PRIMARY KEY,
			count         BIGINT DEFAULT 0,
			updated_at    TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS stats_received_by_hour (
			hour_bucket TIMESTAMPTZ PRIMARY KEY,
			count       BIGINT DEFAULT 0
		)`,
		`CREATE TABLE IF NOT EXISTS stats_analysis_by_hour (
			hour_bucket TIMESTAMPTZ,
			result      BOOLEAN,
			count       BIGINT DEFAULT 0,
			PRIMARY KEY (hour_bucket, result)
		)`,
		`CREATE TABLE IF NOT EXISTS stats_lag (
			lag_type    VARCHAR(50) PRIMARY KEY,
			avg_seconds FLOAT DEFAULT 0,
			min_seconds FLOAT DEFAULT 0,
			max_seconds FLOAT DEFAULT 0,
			p95_seconds FLOAT DEFAULT 0,
			updated_at  TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS stats_disposal_tracking (
			file_id         BIGINT PRIMARY KEY,
			file_name       VARCHAR(255),
			customer_number VARCHAR(9),
			file_creator    VARCHAR(6),
			file_created_at TIMESTAMPTZ,
			disposal_time   VARCHAR(20),
			disposal_date   TIMESTAMPTZ
		)`,
	} {
		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("setup stats table: %w", err)
		}
	}

	// Lodgement tables — operational data, no retention policy
	for _, stmt := range []string{
		`CREATE TABLE IF NOT EXISTS lodgement (
			lodgement_number  VARCHAR(14) PRIMARY KEY,
			receipt_number    VARCHAR(8)  UNIQUE,
			processing_engine VARCHAR(4),
			submitted_at      TIMESTAMPTZ,
			customer_number   VARCHAR(9),
			customer_type     VARCHAR(10),
			supplier_number   VARCHAR(9),
			lodgement_status  VARCHAR(10),
			ingress_location  VARCHAR(5)
		)`,
		`CREATE TABLE IF NOT EXISTS lodgement_objects (
			id                       SERIAL PRIMARY KEY,
			lodgement_number         VARCHAR(14) REFERENCES lodgement(lodgement_number),
			first_analysis_complete  BOOLEAN,
			second_analysis_complete BOOLEAN,
			file_metadata_id         BIGINT
		)`,
		`CREATE TABLE IF NOT EXISTS lodgement_validation (
			lodgement_number   VARCHAR(14) PRIMARY KEY REFERENCES lodgement(lodgement_number),
			risk_score         INT,
			assessment_outcome VARCHAR(11)
		)`,
	} {
		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("setup lodgement table: %w", err)
		}
	}

	// Reset stats tables if RESET_STATS env var is set.
	// Use this once after any suspected double-counting incident, then unset it.
	if os.Getenv("RESET_STATS") == "true" {
		log.Println("RESET_STATS=true: truncating all stats tables and resetting last_id to 0")
		db.Exec(`TRUNCATE stats_by_category, stats_by_direction, stats_by_customer_type,
		                  stats_received_by_hour, stats_analysis_by_hour, stats_lag`)
		db.Exec(`DELETE FROM stats_disposal_tracking`)
		db.Exec(`UPDATE stats_totals SET total_files=0, last_id=0, updated_at=NOW() WHERE id=1`)
	}

	// Seed file_metadata if empty
	var count int
	db.QueryRow("SELECT COUNT(*) FROM file_metadata").Scan(&count)
	if count > 0 {
		log.Printf("file_metadata already has %d rows", count)
		return nil
	}
	jsonPath := getEnv("JSON_DATA_PATH", "file_metadata_1000.json")
	raw, err := os.ReadFile(jsonPath)
	if err != nil {
		return fmt.Errorf("reading JSON: %w", err)
	}
	var jd JSONData
	if err := json.Unmarshal(raw, &jd); err != nil {
		return fmt.Errorf("parsing JSON: %w", err)
	}
	for _, r := range jd.Data {
		analysisResult := rand.Float64() < 0.95
		db.Exec(`
			INSERT INTO file_metadata
			  (customer_number,customer_type,file_name,file_category,file_creator,
			   file_created_at,disposal_time,direction,first_analysis_result)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		`, r.CustomerNumber, r.CustomerType, r.FileName, r.FileCategory,
			r.FileCreator, r.FileCreatedAt, r.DisposalTime, r.Direction, analysisResult)
	}
	log.Printf("seeded %d records into file_metadata", len(jd.Data))
	return nil
}

// ── Aggregator (Function 1) ───────────────────────────────────────────────────

func runAggregation() {
	if err := processNewFiles(); err != nil {
		log.Printf("aggregator: processNewFiles: %v", err)
	}
	if err := recomputeLag(); err != nil {
		log.Printf("aggregator: recomputeLag: %v", err)
	}
	if err := pruneRetention(); err != nil {
		log.Printf("aggregator: pruneRetention: %v", err)
	}
}

type fileRow struct {
	id                     int64
	fileCategory           string
	direction              string
	customerType           string
	firstAnalysisResult    sql.NullBool
	firstAnalysisCompleteAt sql.NullTime
	fileReceivedAt         time.Time
	fileCreatedAt          time.Time
	fileName               string
	customerNumber         string
	fileCreator            string
	disposalTime           string
}

func processNewFiles() error {
	const batchSize = 500
	for {
		var lastID int64
		db.QueryRow("SELECT last_id FROM stats_totals WHERE id = 1").Scan(&lastID)

		rows, err := db.Query(`
			SELECT id,
			       file_category, direction, customer_type,
			       first_analysis_result,
			       first_analysis_complete_at,
			       COALESCE(file_received_at, file_created_at),
			       file_name, customer_number, file_creator,
			       file_created_at, disposal_time
			FROM file_metadata
			WHERE id > $1
			ORDER BY id
			LIMIT $2
		`, lastID, batchSize)
		if err != nil {
			return err
		}

		// Read all rows into memory before opening a transaction so the
		// cursor and the transaction don't compete for the same connection.
		var batch []fileRow
		for rows.Next() {
			var r fileRow
			if err := rows.Scan(
				&r.id, &r.fileCategory, &r.direction, &r.customerType,
				&r.firstAnalysisResult, &r.firstAnalysisCompleteAt, &r.fileReceivedAt,
				&r.fileName, &r.customerNumber, &r.fileCreator, &r.fileCreatedAt, &r.disposalTime,
			); err != nil {
				rows.Close()
				return err
			}
			batch = append(batch, r)
		}
		rows.Close()

		if len(batch) == 0 {
			return nil
		}

		// Wrap the entire batch in one transaction so that a mid-batch crash
		// leaves last_id unchanged and the batch is retried cleanly on restart.
		tx, err := db.Begin()
		if err != nil {
			return err
		}

		var newLastID int64
		for _, r := range batch {
			hourBucket := r.fileReceivedAt.UTC().Truncate(time.Hour)

			tx.Exec(`INSERT INTO stats_by_category (file_category,count,updated_at) VALUES ($1,1,NOW())
			         ON CONFLICT (file_category) DO UPDATE SET count=stats_by_category.count+1, updated_at=NOW()`, r.fileCategory)
			tx.Exec(`INSERT INTO stats_by_direction (direction,count,updated_at) VALUES ($1,1,NOW())
			         ON CONFLICT (direction) DO UPDATE SET count=stats_by_direction.count+1, updated_at=NOW()`, r.direction)
			tx.Exec(`INSERT INTO stats_by_customer_type (customer_type,count,updated_at) VALUES ($1,1,NOW())
			         ON CONFLICT (customer_type) DO UPDATE SET count=stats_by_customer_type.count+1, updated_at=NOW()`, r.customerType)
			tx.Exec(`INSERT INTO stats_received_by_hour (hour_bucket,count) VALUES ($1,1)
			         ON CONFLICT (hour_bucket) DO UPDATE SET count=stats_received_by_hour.count+1`, hourBucket)

			if r.firstAnalysisResult.Valid && r.firstAnalysisCompleteAt.Valid {
				analysisBucket := r.firstAnalysisCompleteAt.Time.UTC().Truncate(time.Hour)
				tx.Exec(`INSERT INTO stats_analysis_by_hour (hour_bucket,result,count) VALUES ($1,$2,1)
				         ON CONFLICT (hour_bucket,result) DO UPDATE SET count=stats_analysis_by_hour.count+1`,
					analysisBucket, r.firstAnalysisResult.Bool)
			}

			dd := disposalDateGo(r.fileCreatedAt, r.disposalTime)
			tx.Exec(`INSERT INTO stats_disposal_tracking
			         (file_id,file_name,customer_number,file_creator,file_created_at,disposal_time,disposal_date)
			         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (file_id) DO NOTHING`,
				r.id, r.fileName, r.customerNumber, r.fileCreator, r.fileCreatedAt, r.disposalTime, dd)

			newLastID = r.id
		}

		tx.Exec(`UPDATE stats_totals SET total_files=total_files+$1, last_id=$2, updated_at=NOW() WHERE id=1`,
			int64(len(batch)), newLastID)

		if err := tx.Commit(); err != nil {
			tx.Rollback()
			return err
		}

		log.Printf("aggregator: processed %d new records (last_id=%d)", len(batch), newLastID)

		if len(batch) < batchSize {
			return nil
		}
	}
}

func recomputeLag() error {
	// Column names come from the hardcoded slice below, not from user input — fmt.Sprintf is safe here.
	for _, l := range []struct{ name, a, b string }{
		{"received_to_first_analysis", "first_analysis_complete_at", "file_received_at"},
		{"received_to_second_analysis", "second_analysis_complete_at", "file_received_at"},
	} {
		_, err := db.Exec(fmt.Sprintf(`
			INSERT INTO stats_lag (lag_type,avg_seconds,min_seconds,max_seconds,p95_seconds,updated_at)
			SELECT $1,
			    AVG(EXTRACT(EPOCH FROM (%s-%s))),
			    MIN(EXTRACT(EPOCH FROM (%s-%s))),
			    MAX(EXTRACT(EPOCH FROM (%s-%s))),
			    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (%s-%s))),
			    NOW()
			FROM file_metadata WHERE %s IS NOT NULL AND %s IS NOT NULL
			ON CONFLICT (lag_type) DO UPDATE SET
			    avg_seconds=EXCLUDED.avg_seconds, min_seconds=EXCLUDED.min_seconds,
			    max_seconds=EXCLUDED.max_seconds, p95_seconds=EXCLUDED.p95_seconds,
			    updated_at=NOW()
		`, l.a, l.b, l.a, l.b, l.a, l.b, l.a, l.b, l.a, l.b), l.name)
		if err != nil {
			return err
		}
	}
	return nil
}

func pruneRetention() error {
	res, err := db.Exec(`DELETE FROM file_metadata WHERE file_received_at < NOW() - INTERVAL '2 days'`)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n > 0 {
		log.Printf("aggregator: pruned %d records from file_metadata (retention: 2 days)", n)
	}
	return nil
}

func disposalDateGo(createdAt time.Time, dt string) time.Time {
	switch dt {
	case "6 months":
		return createdAt.AddDate(0, 6, 0)
	case "2 years":
		return createdAt.AddDate(2, 0, 0)
	case "7 years":
		return createdAt.AddDate(7, 0, 0)
	case "45 years":
		return createdAt.AddDate(45, 0, 0)
	}
	return createdAt
}

// ── GraphQL types ─────────────────────────────────────────────────────────────

var overdueFileType = graphql.NewObject(graphql.ObjectConfig{
	Name: "OverdueFile",
	Fields: graphql.Fields{
		"fileId":        &graphql.Field{Type: graphql.Int},
		"fileCreatedAt": &graphql.Field{Type: graphql.String},
		"disposalTime":  &graphql.Field{Type: graphql.String},
		"disposalDate":  &graphql.Field{Type: graphql.String},
		"daysOverdue":   &graphql.Field{Type: graphql.Int},
	},
})

var categoryCountType = graphql.NewObject(graphql.ObjectConfig{
	Name: "CategoryCount",
	Fields: graphql.Fields{
		"category": &graphql.Field{Type: graphql.String},
		"count":    &graphql.Field{Type: graphql.Int},
	},
})

var directionCountType = graphql.NewObject(graphql.ObjectConfig{
	Name: "DirectionCount",
	Fields: graphql.Fields{
		"direction": &graphql.Field{Type: graphql.String},
		"count":     &graphql.Field{Type: graphql.Int},
	},
})

var customerTypeCountType = graphql.NewObject(graphql.ObjectConfig{
	Name: "CustomerTypeCount",
	Fields: graphql.Fields{
		"customerType": &graphql.Field{Type: graphql.String},
		"count":        &graphql.Field{Type: graphql.Int},
	},
})

var recentCountsType = graphql.NewObject(graphql.ObjectConfig{
	Name: "RecentCounts",
	Fields: graphql.Fields{
		"thisHour": &graphql.Field{Type: graphql.Int},
		"thisWeek": &graphql.Field{Type: graphql.Int},
		"thisYear": &graphql.Field{Type: graphql.Int},
	},
})

var analysisResultType = graphql.NewObject(graphql.ObjectConfig{
	Name: "AnalysisResult",
	Fields: graphql.Fields{
		"passedThisWeek": &graphql.Field{Type: graphql.Int},
		"passedThisYear": &graphql.Field{Type: graphql.Int},
		"failedThisWeek": &graphql.Field{Type: graphql.Int},
		"failedThisYear": &graphql.Field{Type: graphql.Int},
	},
})

var lagStatsType = graphql.NewObject(graphql.ObjectConfig{
	Name: "LagStats",
	Fields: graphql.Fields{
		"lagType":    &graphql.Field{Type: graphql.String},
		"avgSeconds": &graphql.Field{Type: graphql.Float},
		"minSeconds": &graphql.Field{Type: graphql.Float},
		"maxSeconds": &graphql.Field{Type: graphql.Float},
		"p95Seconds": &graphql.Field{Type: graphql.Float},
	},
})

// ── GraphQL API (Function 2) ──────────────────────────────────────────────────

func buildSchema() (graphql.Schema, error) {
	query := graphql.NewObject(graphql.ObjectConfig{
		Name: "Query",
		Fields: graphql.Fields{
			"overdueFiles":        {Type: graphql.NewList(overdueFileType), Resolve: resolveOverdueFiles},
			"filesByCategory":     {Type: graphql.NewList(categoryCountType), Resolve: resolveFilesByCategory},
			"filesByDirection":    {Type: graphql.NewList(directionCountType), Resolve: resolveFilesByDirection},
			"filesByCustomerType": {Type: graphql.NewList(customerTypeCountType), Resolve: resolveFilesByCustomerType},
			"recentFileCounts":    {Type: recentCountsType, Resolve: resolveRecentFileCounts},
			"firstAnalysisResult": {Type: analysisResultType, Resolve: resolveFirstAnalysisResult},
			"lagStats":            {Type: graphql.NewList(lagStatsType), Resolve: resolveLagStats},
		},
	})
	return graphql.NewSchema(graphql.SchemaConfig{Query: query})
}

func resolveOverdueFiles(p graphql.ResolveParams) (interface{}, error) {
	rows, err := db.Query(`
		SELECT file_id,
		       TO_CHAR(file_created_at,'YYYY-MM-DD'),
		       disposal_time,
		       TO_CHAR(disposal_date,'YYYY-MM-DD'),
		       (EXTRACT(DAY FROM NOW() - disposal_date))::int
		FROM stats_disposal_tracking
		WHERE disposal_date < NOW()
		ORDER BY disposal_date ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []map[string]interface{}
	for rows.Next() {
		var fileID int64
		var created, dt, dd string
		var daysOverdue int
		if err := rows.Scan(&fileID, &created, &dt, &dd, &daysOverdue); err != nil {
			return nil, err
		}
		out = append(out, map[string]interface{}{
			"fileId": fileID, "fileCreatedAt": created,
			"disposalTime": dt, "disposalDate": dd, "daysOverdue": daysOverdue,
		})
	}
	return out, nil
}

func resolveFilesByCategory(p graphql.ResolveParams) (interface{}, error) {
	rows, err := db.Query(`SELECT file_category, count::int FROM stats_by_category ORDER BY count DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []map[string]interface{}
	for rows.Next() {
		var cat string
		var count int
		if err := rows.Scan(&cat, &count); err != nil {
			return nil, err
		}
		out = append(out, map[string]interface{}{"category": cat, "count": count})
	}
	return out, nil
}

func resolveFilesByDirection(p graphql.ResolveParams) (interface{}, error) {
	rows, err := db.Query(`SELECT direction, count::int FROM stats_by_direction ORDER BY count DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []map[string]interface{}
	for rows.Next() {
		var dir string
		var count int
		if err := rows.Scan(&dir, &count); err != nil {
			return nil, err
		}
		out = append(out, map[string]interface{}{"direction": dir, "count": count})
	}
	return out, nil
}

func resolveFilesByCustomerType(p graphql.ResolveParams) (interface{}, error) {
	rows, err := db.Query(`SELECT customer_type, count::int FROM stats_by_customer_type ORDER BY count DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []map[string]interface{}
	for rows.Next() {
		var ct string
		var count int
		if err := rows.Scan(&ct, &count); err != nil {
			return nil, err
		}
		out = append(out, map[string]interface{}{"customerType": ct, "count": count})
	}
	return out, nil
}

func resolveRecentFileCounts(p graphql.ResolveParams) (interface{}, error) {
	var thisHour, thisWeek, thisYear int
	err := db.QueryRow(`
		SELECT
		    COALESCE(SUM(count) FILTER (WHERE hour_bucket >= DATE_TRUNC('hour', NOW())), 0),
		    COALESCE(SUM(count) FILTER (WHERE hour_bucket >= DATE_TRUNC('week', NOW())), 0),
		    COALESCE(SUM(count) FILTER (WHERE hour_bucket >= DATE_TRUNC('year', NOW())), 0)
		FROM stats_received_by_hour
	`).Scan(&thisHour, &thisWeek, &thisYear)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"thisHour": thisHour, "thisWeek": thisWeek, "thisYear": thisYear}, nil
}

func resolveFirstAnalysisResult(p graphql.ResolveParams) (interface{}, error) {
	var passedWeek, passedYear, failedWeek, failedYear int
	err := db.QueryRow(`
		SELECT
		    COALESCE(SUM(count) FILTER (WHERE result=true  AND hour_bucket >= DATE_TRUNC('week', NOW())), 0),
		    COALESCE(SUM(count) FILTER (WHERE result=true  AND hour_bucket >= DATE_TRUNC('year', NOW())), 0),
		    COALESCE(SUM(count) FILTER (WHERE result=false AND hour_bucket >= DATE_TRUNC('week', NOW())), 0),
		    COALESCE(SUM(count) FILTER (WHERE result=false AND hour_bucket >= DATE_TRUNC('year', NOW())), 0)
		FROM stats_analysis_by_hour
	`).Scan(&passedWeek, &passedYear, &failedWeek, &failedYear)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"passedThisWeek": passedWeek, "passedThisYear": passedYear,
		"failedThisWeek": failedWeek, "failedThisYear": failedYear,
	}, nil
}

func resolveLagStats(p graphql.ResolveParams) (interface{}, error) {
	rows, err := db.Query(`SELECT lag_type, avg_seconds, min_seconds, max_seconds, p95_seconds FROM stats_lag`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []map[string]interface{}
	for rows.Next() {
		var lagType string
		var avg, min, max, p95 float64
		if err := rows.Scan(&lagType, &avg, &min, &max, &p95); err != nil {
			return nil, err
		}
		out = append(out, map[string]interface{}{
			"lagType": lagType, "avgSeconds": avg, "minSeconds": min, "maxSeconds": max, "p95Seconds": p95,
		})
	}
	return out, nil
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func graphqlHandler(schema *graphql.Schema) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var params struct {
			Query         string                 `json:"query"`
			OperationName string                 `json:"operationName"`
			Variables     map[string]interface{} `json:"variables"`
		}
		if r.Method == http.MethodPost {
			if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
		} else {
			params.Query = r.URL.Query().Get("query")
		}
		result := graphql.Do(graphql.Params{
			Schema:        *schema,
			RequestString: params.Query,
			VariableValues: params.Variables,
			OperationName: params.OperationName,
		})
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	})
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
