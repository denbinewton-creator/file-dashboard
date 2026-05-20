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

// Valid value sets — must stay consistent with existing data
var (
	customerNumbers = []string{"987654321", "456123789", "111999888", "444555666", "789321654", "321654987", "123456789"}
	fileCreators    = []string{"334455", "123456", "789012", "445566", "667788", "112233"}
	disposalTimes   = []string{"6 months", "2 years", "7 years", "45 years"}
	directions      = []string{"inbound", "outbound"}
	extensions      = []string{".pdf", ".jpeg", ".docx", ".xlsx"}
	adjectives      = []string{"primary", "secondary", "internal", "external", "standard", "monthly", "quarterly", "annual", "detailed", "archived", "preliminary", "final", "urgent", "routine"}
	nouns           = []string{"document", "report", "claim", "certificate", "register", "log", "review", "response", "catalogue", "statement", "summary", "invoice", "notice", "record"}

	// Weighted: type_1 ~55%, type_2 ~30%, type_3 ~15%
	customerTypeWeights = []struct{ val string; w int }{
		{"type_1", 55}, {"type_2", 30}, {"type_3", 15},
	}

	// Weighted: letter ~42%, receipt ~28%, photo ~18%, spreadsheet ~12%
	fileCategoryWeights = []struct{ val string; w int }{
		{"letter", 42}, {"receipt", 28}, {"photo", 18}, {"spreadsheet", 12},
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
func randomName() string           { return pick(adjectives) + " " + pick(nouns) + pick(extensions) }
func getEnv(k, def string) string  {
	if v := os.Getenv(k); v != "" { return v }
	return def
}

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

	// Write PID file so manage.ps1 can stop this process
	os.WriteFile(pidFile, []byte(fmt.Sprintf("%d", os.Getpid())), 0644)
	defer os.Remove(pidFile)

	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGTERM, syscall.SIGINT)

	// 200 records per hour = avg 18s per insert, randomised 5-31s
	log.Printf("BAU file imitator running - 200 records/hr (randomised 5-31s intervals). PID %d", os.Getpid())

	for {
		insert(db)

		// uniform 5-31s -> mean 18s -> 200/hr
		wait := time.Duration(5+rand.Intn(27)) * time.Second
		log.Printf("next insert in %s", wait.Round(time.Second))

		select {
		case <-sigs:
			log.Println("BAU imitator stopping.")
			return
		case <-time.After(wait):
		}
	}
}

func insert(db *sql.DB) {
	now := time.Now().UTC()

	// file_created_at is in the past — same 5min→3month lag range as the seed data
	lagSec := 5*60 + rand.Intn((90*24*60*60)-(5*60))
	createdAt := now.Add(-time.Duration(lagSec) * time.Second)

	// file_received_at is NOW
	receivedAt := now

	// first_analysis: 0.5s–5s after received
	firstAt := receivedAt.Add(time.Duration(500+rand.Intn(4500)) * time.Millisecond)

	// second_analysis: 15s–3min after received
	secondAt := receivedAt.Add(time.Duration(15+rand.Intn(165)) * time.Second)

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
		log.Printf("insert error: %v", err)
		return
	}
	log.Printf("inserted — created: %s  received: %s", createdAt.Format("2006-01-02 15:04"), now.Format("15:04:05"))
}
