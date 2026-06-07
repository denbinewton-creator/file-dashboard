package main

import (
	"database/sql"
	"fmt"
	"log"
	"math/rand"
	"os"
	"os/signal"
	"syscall"
	"time"

	_ "github.com/lib/pq"
)

// ── Value sets ────────────────────────────────────────────────────────────────

var (
	customerNumbers = []string{"987654321", "456123789", "111999888", "444555666", "789321654", "321654987", "123456789"}
	fileCreators    = []string{"334455", "123456", "789012", "445566", "667788", "112233"}
	disposalTimes   = []string{"6 months", "2 years", "7 years", "45 years"}
	directions      = []string{"inbound", "outbound"}
	extensions      = []string{".pdf", ".jpeg", ".docx", ".xlsx"}
	adjectives      = []string{"primary", "secondary", "internal", "external", "standard", "monthly", "quarterly", "annual", "detailed", "archived", "preliminary", "final", "urgent", "routine"}
	nouns           = []string{"document", "report", "claim", "certificate", "register", "log", "review", "response", "catalogue", "statement", "summary", "invoice", "notice", "record"}

	// file_metadata weighted distributions
	customerTypeWeights = []struct{ val string; w int }{
		{"type_1", 55}, {"type_2", 30}, {"type_3", 15},
	}
	fileCategoryWeights = []struct{ val string; w int }{
		{"letter", 42}, {"receipt", 28}, {"photo", 18}, {"spreadsheet", 12},
	}

	// lodgement weighted distributions
	processingEngineWeights = []struct{ val string; w int }{
		{"PE-1", 30}, {"PE-2", 50}, {"PE-3", 20},
	}
	ingressLocationWeights = []struct{ val string; w int }{
		{"UI-1", 10}, {"UI-2", 60}, {"API-1", 30},
	}
	assessmentOutcomeWeights = []struct{ val string; w int }{
		{"PASSED", 60}, {"INVESTIGATE", 10}, {"REJECTED", 30},
	}
	lodgementStatusWeights = []struct{ val string; w int }{
		{"DRAFT", 10}, {"TERMINATED", 10}, {"LODGED", 80},
	}
)

func pick(s []string) string { return s[rand.Intn(len(s))] }

func pickWeighted(options []struct{ val string; w int }) string {
	total := 0
	for _, o := range options { total += o.w }
	r := rand.Intn(total)
	for _, o := range options {
		r -= o.w
		if r < 0 { return o.val }
	}
	return options[len(options)-1].val
}

func randomName() string          { return pick(adjectives) + " " + pick(nouns) + pick(extensions) }
func getEnv(k, def string) string {
	if v := os.Getenv(k); v != "" { return v }
	return def
}

// ── Main ──────────────────────────────────────────────────────────────────────

func main() {
	connStr := getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/file_dashboard?sslmode=disable")
	pidFile := getEnv("PID_FILE", "../bau.pid")

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("open db: %v", err)
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
		log.Fatalf("connect db: %v", err)
	}

	os.WriteFile(pidFile, []byte(fmt.Sprintf("%d", os.Getpid())), 0644)
	defer os.Remove(pidFile)

	// done is closed on SIGTERM/SIGINT so both goroutines can exit cleanly.
	done := make(chan struct{})
	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGTERM, syscall.SIGINT)
	go func() { <-sigs; close(done) }()

	log.Printf("BAU imitator running — files: 300/hr · lodgements: ~50/hr. PID %d", os.Getpid())

	// File insertion: 300/hr — uniform 3–21 s per insert (mean 12 s).
	go func() {
		for {
			insertFile(db)
			wait := time.Duration(3+rand.Intn(19)) * time.Second
			select {
			case <-done:
				return
			case <-time.After(wait):
			}
		}
	}()

	// Lodgement insertion: ~50/hr — uniform 12–132 s per insert (mean 72 s).
	// Each lodgement links 1–12 random files from file_metadata.
	go func() {
		for {
			insertLodgement(db)
			wait := time.Duration(12+rand.Intn(121)) * time.Second
			select {
			case <-done:
				return
			case <-time.After(wait):
			}
		}
	}()

	<-done
	log.Println("BAU imitator stopping.")
}

// ── File insert ───────────────────────────────────────────────────────────────

func insertFile(db *sql.DB) {
	now := time.Now().UTC()

	// file_created_at is 5 min to 3 months in the past — simulates creation-to-receipt lag.
	lagSec    := 5*60 + rand.Intn((90*24*60*60)-(5*60))
	createdAt := now.Add(-time.Duration(lagSec) * time.Second)

	receivedAt := now
	firstAt    := receivedAt.Add(time.Duration(500+rand.Intn(4500)) * time.Millisecond)
	secondAt   := receivedAt.Add(time.Duration(15+rand.Intn(165)) * time.Second)

	analysisResult := rand.Float64() < 0.95
	_, err := db.Exec(`
		INSERT INTO file_metadata
		  (customer_number, customer_type, file_name, file_category, file_creator,
		   file_created_at, disposal_time, direction,
		   file_received_at, first_analysis_complete_at, second_analysis_complete_at,
		   first_analysis_result)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
	`,
		pick(customerNumbers), pickWeighted(customerTypeWeights), randomName(),
		pickWeighted(fileCategoryWeights), pick(fileCreators), createdAt,
		pick(disposalTimes), pick(directions),
		receivedAt, firstAt, secondAt, analysisResult,
	)
	if err != nil {
		log.Printf("file insert error: %v", err)
		return
	}
	log.Printf("file inserted — created: %s  received: %s", createdAt.Format("2006-01-02 15:04"), now.Format("15:04:05"))
}

// ── Lodgement insert ──────────────────────────────────────────────────────────

type fileRef struct {
	id                     int64
	customerNumber         string
	customerType           string
	createdAt              time.Time
	firstAnalysisResult    bool
	secondAnalysisComplete bool
}

func insertLodgement(db *sql.DB) {
	now := time.Now().UTC()

	// Select 1–12 random files from file_metadata.
	// submitted_at will be set close to the selected files' creation timestamps,
	// satisfying the "within a margin of each other" constraint.
	numFiles := 1 + rand.Intn(12)
	rows, err := db.Query(`
		SELECT id, customer_number, customer_type, file_created_at,
		       first_analysis_result,
		       second_analysis_complete_at IS NOT NULL AND second_analysis_complete_at <= NOW()
		FROM file_metadata
		ORDER BY RANDOM()
		LIMIT $1
	`, numFiles)
	if err != nil {
		log.Printf("lodgement: query files: %v", err)
		return
	}

	var files []fileRef
	for rows.Next() {
		var f fileRef
		var far sql.NullBool
		if err := rows.Scan(&f.id, &f.customerNumber, &f.customerType, &f.createdAt, &far, &f.secondAnalysisComplete); err != nil {
			rows.Close()
			log.Printf("lodgement: scan: %v", err)
			return
		}
		f.firstAnalysisResult = far.Valid && far.Bool
		files = append(files, f)
	}
	rows.Close()

	if len(files) == 0 {
		log.Printf("lodgement: no files available yet, skipping")
		return
	}

	// submitted_at = latest file_created_at ± up to 1 hour.
	latestCreatedAt := files[0].createdAt
	for _, f := range files[1:] {
		if f.createdAt.After(latestCreatedAt) {
			latestCreatedAt = f.createdAt
		}
	}
	offsetSec   := rand.Intn(7200) - 3600
	submittedAt := latestCreatedAt.Add(time.Duration(offsetSec) * time.Second)

	// Unique identifiers: timestamp-based digits mixed with random to avoid collision.
	n               := now.UnixNano()
	lodgementNumber := fmt.Sprintf("%04d-%04d-%04d",
		(n/1_000_000_000)%10000,
		(n/100_000)%10000,
		rand.Intn(10000))
	receiptNumber  := fmt.Sprintf("%08d", rand.Intn(90_000_000)+10_000_000)
	supplierNumber := fmt.Sprintf("%04d-%04d", rand.Intn(10000), rand.Intn(10000))

	status  := pickWeighted(lodgementStatusWeights)
	outcome := pickWeighted(assessmentOutcomeWeights)

	// All three inserts are wrapped in one transaction so a partial failure
	// leaves no orphaned lodgement or validation rows.
	tx, err := db.Begin()
	if err != nil {
		log.Printf("lodgement: begin tx: %v", err)
		return
	}

	_, err = tx.Exec(`
		INSERT INTO lodgement
		  (lodgement_number, receipt_number, processing_engine, submitted_at,
		   customer_number, customer_type, supplier_number, lodgement_status, ingress_location)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
	`,
		lodgementNumber, receiptNumber,
		pickWeighted(processingEngineWeights),
		submittedAt,
		files[0].customerNumber, files[0].customerType,
		supplierNumber, status,
		pickWeighted(ingressLocationWeights),
	)
	if err != nil {
		tx.Rollback()
		log.Printf("lodgement: insert lodgement: %v", err)
		return
	}

	for _, f := range files {
		_, err = tx.Exec(`
			INSERT INTO lodgement_objects
			  (lodgement_number, first_analysis_complete, second_analysis_complete, file_metadata_id)
			VALUES ($1,$2,$3,$4)
		`, lodgementNumber, f.firstAnalysisResult, f.secondAnalysisComplete, f.id)
		if err != nil {
			tx.Rollback()
			log.Printf("lodgement: insert object: %v", err)
			return
		}
	}

	riskScore := 1 + rand.Intn(100)
	_, err = tx.Exec(`
		INSERT INTO lodgement_validation (lodgement_number, risk_score, assessment_outcome)
		VALUES ($1,$2,$3)
	`, lodgementNumber, riskScore, outcome)
	if err != nil {
		tx.Rollback()
		log.Printf("lodgement: insert validation: %v", err)
		return
	}

	if err := tx.Commit(); err != nil {
		log.Printf("lodgement: commit: %v", err)
		return
	}

	log.Printf("lodgement inserted — %s  files: %d  status: %s  outcome: %s  risk: %d",
		lodgementNumber, len(files), status, outcome, riskScore)
}
