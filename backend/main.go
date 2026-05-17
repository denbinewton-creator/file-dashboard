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

	schema, err := buildSchema()
	if err != nil {
		log.Fatalf("failed to build schema: %v", err)
	}

	mux := http.NewServeMux()
	mux.Handle("/graphql", corsMiddleware(graphqlHandler(&schema)))

	log.Println("backend listening on :8080  (GraphiQL at http://localhost:8080/graphql)")
	log.Fatal(http.ListenAndServe(":8080", mux))
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

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
			Schema:         *schema,
			RequestString:  params.Query,
			VariableValues: params.Variables,
			OperationName:  params.OperationName,
		})
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	})
}

func setupDB() error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS file_metadata (
			id                         SERIAL PRIMARY KEY,
			customer_number            VARCHAR(9),
			customer_type              VARCHAR(10),
			file_name                  VARCHAR(255),
			file_category              VARCHAR(20),
			file_creator               VARCHAR(6),
			file_created_at            TIMESTAMPTZ,
			disposal_time              VARCHAR(20),
			direction                  VARCHAR(10),
			file_received_at           TIMESTAMPTZ,
			first_analysis_complete_at  TIMESTAMPTZ,
			second_analysis_complete_at  TIMESTAMPTZ,
			first_analysis_result        BOOLEAN
		)
	`)
	if err != nil {
		return fmt.Errorf("create table: %w", err)
	}

	// Add new columns if upgrading an existing table
	for _, col := range []struct{ name, typ string }{
		{"file_received_at", "TIMESTAMPTZ"},
		{"first_analysis_complete_at", "TIMESTAMPTZ"},
		{"second_analysis_complete_at", "TIMESTAMPTZ"},
		{"first_analysis_result", "BOOLEAN"},
	} {
		db.Exec(fmt.Sprintf("ALTER TABLE file_metadata ADD COLUMN IF NOT EXISTS %s %s", col.name, col.typ))
	}
	var count int
	db.QueryRow("SELECT COUNT(*) FROM file_metadata").Scan(&count)
	if count > 0 {
		log.Printf("database already seeded (%d rows)", count)
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
		_, err := db.Exec(`
			INSERT INTO file_metadata
			  (customer_number,customer_type,file_name,file_category,file_creator,file_created_at,disposal_time,direction,first_analysis_result)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		`, r.CustomerNumber, r.CustomerType, r.FileName, r.FileCategory,
			r.FileCreator, r.FileCreatedAt, r.DisposalTime, r.Direction, analysisResult)
		if err != nil {
			return fmt.Errorf("inserting record: %w", err)
		}
	}
	log.Printf("seeded %d records", len(jd.Data))
	return nil
}

// ── GraphQL types ────────────────────────────────────────────────────────────

var timelineEntryType = graphql.NewObject(graphql.ObjectConfig{
	Name: "TimelineEntry",
	Fields: graphql.Fields{
		"period": &graphql.Field{Type: graphql.String},
		"count":  &graphql.Field{Type: graphql.Int},
	},
})

var creatorCountType = graphql.NewObject(graphql.ObjectConfig{
	Name: "CreatorCount",
	Fields: graphql.Fields{
		"creator": &graphql.Field{Type: graphql.String},
		"count":   &graphql.Field{Type: graphql.Int},
	},
})

var customerCountType = graphql.NewObject(graphql.ObjectConfig{
	Name: "CustomerCount",
	Fields: graphql.Fields{
		"customerNumber": &graphql.Field{Type: graphql.String},
		"count":          &graphql.Field{Type: graphql.Int},
	},
})

var disposalBucketType = graphql.NewObject(graphql.ObjectConfig{
	Name: "DisposalBucket",
	Fields: graphql.Fields{
		"year":  &graphql.Field{Type: graphql.String},
		"count": &graphql.Field{Type: graphql.Int},
	},
})

var overdueFileType = graphql.NewObject(graphql.ObjectConfig{
	Name: "OverdueFile",
	Fields: graphql.Fields{
		"fileName":       &graphql.Field{Type: graphql.String},
		"customerNumber": &graphql.Field{Type: graphql.String},
		"fileCreator":    &graphql.Field{Type: graphql.String},
		"fileCreatedAt":  &graphql.Field{Type: graphql.String},
		"disposalTime":   &graphql.Field{Type: graphql.String},
		"disposalDate":   &graphql.Field{Type: graphql.String},
		"daysOverdue":    &graphql.Field{Type: graphql.Int},
	},
})

var categoryCountType = graphql.NewObject(graphql.ObjectConfig{
	Name: "CategoryCount",
	Fields: graphql.Fields{
		"category": &graphql.Field{Type: graphql.String},
		"count":    &graphql.Field{Type: graphql.Int},
	},
})

var customerTypeCountType = graphql.NewObject(graphql.ObjectConfig{
	Name: "CustomerTypeCount",
	Fields: graphql.Fields{
		"customerType": &graphql.Field{Type: graphql.String},
		"count":        &graphql.Field{Type: graphql.Int},
	},
})

var customerCreatorType = graphql.NewObject(graphql.ObjectConfig{
	Name: "CustomerCreatorRelation",
	Fields: graphql.Fields{
		"customerNumber": &graphql.Field{Type: graphql.String},
		"fileCreator":    &graphql.Field{Type: graphql.String},
		"count":          &graphql.Field{Type: graphql.Int},
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

var lagOutlierType = graphql.NewObject(graphql.ObjectConfig{
	Name: "LagOutlier",
	Fields: graphql.Fields{
		"fileName":       &graphql.Field{Type: graphql.String},
		"customerNumber": &graphql.Field{Type: graphql.String},
		"fileCreator":    &graphql.Field{Type: graphql.String},
		"lagType":        &graphql.Field{Type: graphql.String},
		"lagSeconds":     &graphql.Field{Type: graphql.Float},
		"zScore":         &graphql.Field{Type: graphql.Float},
	},
})

// ── Schema ───────────────────────────────────────────────────────────────────

func buildSchema() (graphql.Schema, error) {
	query := graphql.NewObject(graphql.ObjectConfig{
		Name: "Query",
		Fields: graphql.Fields{
			"filesTimeline": {
				Type:    graphql.NewList(timelineEntryType),
				Resolve: resolveFilesTimeline,
			},
			"filesByCreator": {
				Type:    graphql.NewList(creatorCountType),
				Resolve: resolveFilesByCreator,
			},
			"filesByCustomer": {
				Type:    graphql.NewList(customerCountType),
				Resolve: resolveFilesByCustomer,
			},
			"disposalTimeline": {
				Type:    graphql.NewList(disposalBucketType),
				Resolve: resolveDisposalTimeline,
			},
			"overdueFiles": {
				Type:    graphql.NewList(overdueFileType),
				Resolve: resolveOverdueFiles,
			},
			"filesByCategory": {
				Type:    graphql.NewList(categoryCountType),
				Resolve: resolveFilesByCategory,
			},
			"filesByCustomerType": {
				Type:    graphql.NewList(customerTypeCountType),
				Resolve: resolveFilesByCustomerType,
			},
			"customerCreatorRelation": {
				Type:    graphql.NewList(customerCreatorType),
				Resolve: resolveCustomerCreatorRelation,
			},
			"recentFileCounts": {
				Type:    recentCountsType,
				Resolve: resolveRecentFileCounts,
			},
			"firstAnalysisResult": {
				Type:    analysisResultType,
				Resolve: resolveFirstAnalysisResult,
			},
			"lagStats": {
				Type:    graphql.NewList(lagStatsType),
				Resolve: resolveLagStats,
			},
			"lagOutliers": {
				Type:    graphql.NewList(lagOutlierType),
				Resolve: resolveLagOutliers,
			},
		},
	})
	return graphql.NewSchema(graphql.SchemaConfig{Query: query})
}

// ── Resolvers ────────────────────────────────────────────────────────────────

func resolveFilesTimeline(p graphql.ResolveParams) (interface{}, error) {
	rows, err := db.Query(`
		SELECT TO_CHAR(file_created_at,'YYYY-MM') AS period, COUNT(*)::int AS count
		FROM file_metadata
		GROUP BY period
		ORDER BY period
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []map[string]interface{}
	for rows.Next() {
		var period string
		var count int
		if err := rows.Scan(&period, &count); err != nil {
			return nil, err
		}
		out = append(out, map[string]interface{}{"period": period, "count": count})
	}
	return out, nil
}

func resolveFilesByCreator(p graphql.ResolveParams) (interface{}, error) {
	rows, err := db.Query(`
		SELECT file_creator, COUNT(*)::int AS count
		FROM file_metadata
		GROUP BY file_creator
		ORDER BY count ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []map[string]interface{}
	for rows.Next() {
		var creator string
		var count int
		if err := rows.Scan(&creator, &count); err != nil {
			return nil, err
		}
		out = append(out, map[string]interface{}{"creator": creator, "count": count})
	}
	return out, nil
}

func resolveFilesByCustomer(p graphql.ResolveParams) (interface{}, error) {
	rows, err := db.Query(`
		SELECT customer_number, COUNT(*)::int AS count
		FROM file_metadata
		GROUP BY customer_number
		ORDER BY count ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []map[string]interface{}
	for rows.Next() {
		var cn string
		var count int
		if err := rows.Scan(&cn, &count); err != nil {
			return nil, err
		}
		out = append(out, map[string]interface{}{"customerNumber": cn, "count": count})
	}
	return out, nil
}

func disposalExpr() string {
	return `
		CASE
			WHEN disposal_time = '6 months' THEN file_created_at + INTERVAL '6 months'
			WHEN disposal_time = '2 years'  THEN file_created_at + INTERVAL '2 years'
			WHEN disposal_time = '7 years'  THEN file_created_at + INTERVAL '7 years'
			WHEN disposal_time = '45 years' THEN file_created_at + INTERVAL '45 years'
		END`
}

func resolveDisposalTimeline(p graphql.ResolveParams) (interface{}, error) {
	q := fmt.Sprintf(`
		SELECT TO_CHAR(%s,'YYYY') AS yr, COUNT(*)::int AS count
		FROM file_metadata
		GROUP BY yr
		ORDER BY yr
	`, disposalExpr())
	rows, err := db.Query(q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []map[string]interface{}
	for rows.Next() {
		var yr string
		var count int
		if err := rows.Scan(&yr, &count); err != nil {
			return nil, err
		}
		out = append(out, map[string]interface{}{"year": yr, "count": count})
	}
	return out, nil
}

func resolveOverdueFiles(p graphql.ResolveParams) (interface{}, error) {
	expr := disposalExpr()
	q := fmt.Sprintf(`
		SELECT
			file_name,
			customer_number,
			file_creator,
			TO_CHAR(file_created_at,'YYYY-MM-DD') AS created,
			disposal_time,
			TO_CHAR(%s,'YYYY-MM-DD')              AS disposal_date,
			(EXTRACT(DAY FROM NOW() - %s))::int   AS days_overdue
		FROM file_metadata
		WHERE %s < NOW()
		ORDER BY days_overdue DESC
	`, expr, expr, expr)
	rows, err := db.Query(q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []map[string]interface{}
	for rows.Next() {
		var fn, cn, fc, created, dt, dd string
		var daysOverdue int
		if err := rows.Scan(&fn, &cn, &fc, &created, &dt, &dd, &daysOverdue); err != nil {
			return nil, err
		}
		out = append(out, map[string]interface{}{
			"fileName":       fn,
			"customerNumber": cn,
			"fileCreator":    fc,
			"fileCreatedAt":  created,
			"disposalTime":   dt,
			"disposalDate":   dd,
			"daysOverdue":    daysOverdue,
		})
	}
	return out, nil
}

func resolveFilesByCategory(p graphql.ResolveParams) (interface{}, error) {
	rows, err := db.Query(`
		SELECT file_category, COUNT(*)::int AS count
		FROM file_metadata
		GROUP BY file_category
		ORDER BY count DESC
	`)
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

func resolveFilesByCustomerType(p graphql.ResolveParams) (interface{}, error) {
	rows, err := db.Query(`
		SELECT customer_type, COUNT(*)::int AS count
		FROM file_metadata
		GROUP BY customer_type
		ORDER BY count DESC
	`)
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
			COUNT(*) FILTER (WHERE file_received_at >= NOW() - INTERVAL '1 hour')   AS this_hour,
			COUNT(*) FILTER (WHERE file_received_at >= DATE_TRUNC('week',  NOW()))   AS this_week,
			COUNT(*) FILTER (WHERE file_received_at >= DATE_TRUNC('year',  NOW()))   AS this_year
		FROM file_metadata
	`).Scan(&thisHour, &thisWeek, &thisYear)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"thisHour": thisHour,
		"thisWeek": thisWeek,
		"thisYear": thisYear,
	}, nil
}

func resolveFirstAnalysisResult(p graphql.ResolveParams) (interface{}, error) {
	var passedWeek, passedYear, failedWeek, failedYear int
	err := db.QueryRow(`
		SELECT
			COUNT(*) FILTER (WHERE first_analysis_result = true  AND first_analysis_complete_at >= DATE_TRUNC('week', NOW())) AS passed_week,
			COUNT(*) FILTER (WHERE first_analysis_result = true  AND first_analysis_complete_at >= DATE_TRUNC('year', NOW())) AS passed_year,
			COUNT(*) FILTER (WHERE first_analysis_result = false AND first_analysis_complete_at >= DATE_TRUNC('week', NOW())) AS failed_week,
			COUNT(*) FILTER (WHERE first_analysis_result = false AND first_analysis_complete_at >= DATE_TRUNC('year', NOW())) AS failed_year
		FROM file_metadata
		WHERE first_analysis_result IS NOT NULL
	`).Scan(&passedWeek, &passedYear, &failedWeek, &failedYear)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"passedThisWeek": passedWeek,
		"passedThisYear": passedYear,
		"failedThisWeek": failedWeek,
		"failedThisYear": failedYear,
	}, nil
}

func resolveLagStats(p graphql.ResolveParams) (interface{}, error) {
	rows, err := db.Query(`
		SELECT lag_type, avg_s, min_s, max_s, p95_s FROM (
			SELECT 'created_to_received' AS lag_type,
				AVG(EXTRACT(EPOCH FROM (file_received_at - file_created_at)))                                                       AS avg_s,
				MIN(EXTRACT(EPOCH FROM (file_received_at - file_created_at)))                                                       AS min_s,
				MAX(EXTRACT(EPOCH FROM (file_received_at - file_created_at)))                                                       AS max_s,
				PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (file_received_at - file_created_at)))              AS p95_s
			FROM file_metadata WHERE file_received_at IS NOT NULL
			UNION ALL
			SELECT 'received_to_first_analysis',
				AVG(EXTRACT(EPOCH FROM (first_analysis_complete_at - file_received_at))),
				MIN(EXTRACT(EPOCH FROM (first_analysis_complete_at - file_received_at))),
				MAX(EXTRACT(EPOCH FROM (first_analysis_complete_at - file_received_at))),
				PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (first_analysis_complete_at - file_received_at)))
			FROM file_metadata WHERE first_analysis_complete_at IS NOT NULL
			UNION ALL
			SELECT 'received_to_second_analysis',
				AVG(EXTRACT(EPOCH FROM (second_analysis_complete_at - file_received_at))),
				MIN(EXTRACT(EPOCH FROM (second_analysis_complete_at - file_received_at))),
				MAX(EXTRACT(EPOCH FROM (second_analysis_complete_at - file_received_at))),
				PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (second_analysis_complete_at - file_received_at)))
			FROM file_metadata WHERE second_analysis_complete_at IS NOT NULL
		) t
	`)
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
			"lagType":    lagType,
			"avgSeconds": avg,
			"minSeconds": min,
			"maxSeconds": max,
			"p95Seconds": p95,
		})
	}
	return out, nil
}

func resolveLagOutliers(p graphql.ResolveParams) (interface{}, error) {
	rows, err := db.Query(`
		WITH stats AS (
			SELECT
				AVG(EXTRACT(EPOCH FROM (file_received_at - file_created_at)))            AS avg_c2r,
				STDDEV(EXTRACT(EPOCH FROM (file_received_at - file_created_at)))         AS std_c2r,
				AVG(EXTRACT(EPOCH FROM (first_analysis_complete_at - file_received_at))) AS avg_r2f,
				STDDEV(EXTRACT(EPOCH FROM (first_analysis_complete_at - file_received_at))) AS std_r2f,
				AVG(EXTRACT(EPOCH FROM (second_analysis_complete_at - file_received_at))) AS avg_r2s,
				STDDEV(EXTRACT(EPOCH FROM (second_analysis_complete_at - file_received_at))) AS std_r2s
			FROM file_metadata WHERE file_received_at IS NOT NULL
		),
		outliers AS (
			SELECT file_name, customer_number, file_creator,
				'created_to_received' AS lag_type,
				EXTRACT(EPOCH FROM (file_received_at - file_created_at)) AS lag_seconds,
				(EXTRACT(EPOCH FROM (file_received_at - file_created_at)) - avg_c2r) / NULLIF(std_c2r, 0) AS z_score
			FROM file_metadata, stats
			WHERE file_received_at IS NOT NULL
			AND ABS((EXTRACT(EPOCH FROM (file_received_at - file_created_at)) - avg_c2r) / NULLIF(std_c2r, 0)) > 2
			UNION ALL
			SELECT file_name, customer_number, file_creator,
				'received_to_first_analysis',
				EXTRACT(EPOCH FROM (first_analysis_complete_at - file_received_at)),
				(EXTRACT(EPOCH FROM (first_analysis_complete_at - file_received_at)) - avg_r2f) / NULLIF(std_r2f, 0)
			FROM file_metadata, stats
			WHERE first_analysis_complete_at IS NOT NULL
			AND ABS((EXTRACT(EPOCH FROM (first_analysis_complete_at - file_received_at)) - avg_r2f) / NULLIF(std_r2f, 0)) > 2
			UNION ALL
			SELECT file_name, customer_number, file_creator,
				'received_to_second_analysis',
				EXTRACT(EPOCH FROM (second_analysis_complete_at - file_received_at)),
				(EXTRACT(EPOCH FROM (second_analysis_complete_at - file_received_at)) - avg_r2s) / NULLIF(std_r2s, 0)
			FROM file_metadata, stats
			WHERE second_analysis_complete_at IS NOT NULL
			AND ABS((EXTRACT(EPOCH FROM (second_analysis_complete_at - file_received_at)) - avg_r2s) / NULLIF(std_r2s, 0)) > 2
		)
		SELECT file_name, customer_number, file_creator, lag_type, lag_seconds, z_score
		FROM outliers
		ORDER BY ABS(z_score) DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []map[string]interface{}
	for rows.Next() {
		var fileName, customerNumber, fileCreator, lagType string
		var lagSeconds, zScore float64
		if err := rows.Scan(&fileName, &customerNumber, &fileCreator, &lagType, &lagSeconds, &zScore); err != nil {
			return nil, err
		}
		out = append(out, map[string]interface{}{
			"fileName":       fileName,
			"customerNumber": customerNumber,
			"fileCreator":    fileCreator,
			"lagType":        lagType,
			"lagSeconds":     lagSeconds,
			"zScore":         zScore,
		})
	}
	return out, nil
}

func resolveCustomerCreatorRelation(p graphql.ResolveParams) (interface{}, error) {
	rows, err := db.Query(`
		SELECT customer_number, file_creator, COUNT(*)::int AS count
		FROM file_metadata
		GROUP BY customer_number, file_creator
		ORDER BY customer_number, file_creator
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []map[string]interface{}
	for rows.Next() {
		var cn, fc string
		var count int
		if err := rows.Scan(&cn, &fc, &count); err != nil {
			return nil, err
		}
		out = append(out, map[string]interface{}{"customerNumber": cn, "fileCreator": fc, "count": count})
	}
	return out, nil
}
