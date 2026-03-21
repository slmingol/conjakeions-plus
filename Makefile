.PHONY: help count list incomplete summary progress gaps scrape resume retry retry-missing

help:
	@echo "Available commands:"
	@echo "  make count       - Show total number of collected puzzles"
	@echo "  make list        - List all puzzle IDs with category counts"
	@echo "  make summary     - Show first and last 10 puzzles"
	@echo "  make incomplete  - Find puzzles with incomplete categories"
	@echo "  make progress    - Check current scraper progress"
	@echo "  make gaps        - Show missing puzzle IDs in collection"
	@echo "  make scrape      - Run scraper for N days (default: 20)"
	@echo "  make resume      - Auto-resume from oldest puzzle (default: 300 days)"
	@echo "  make retry IDS='881 883' - Retry specific puzzle IDs"
	@echo "  make retry-missing - Auto-detect and retry all missing puzzles"

count:
	@jq '.puzzles | length' data/collected-puzzles.json

list:
	@jq -r '.puzzles[] | "\(.id) - \(.categories | length) categories - Words: \(.categories | map(.words | length) | join(","))"' data/collected-puzzles.json

summary:
	@echo "First 10 puzzles:"
	@jq -r '.puzzles | sort_by(.id) | limit(10; .[]) | "\(.id) - \(.date) - \(.categories[0].name)"' data/collected-puzzles.json
	@echo ""
	@echo "Last 10 puzzles:"
	@jq -r '.puzzles | sort_by(.id) | reverse | limit(10; .[]) | "\(.id) - \(.date) - \(.categories[0].name)"' data/collected-puzzles.json

incomplete:
	@jq -r '.puzzles[] | select(.categories | map(.words | length) | any(. != 4)) | "\(.id) - \(.date) - Categories: \(.categories | map(.words | length) | join(","))"' data/collected-puzzles.json || echo "All puzzles have complete 4x4 categories!"

progress:
	@echo "Collected puzzles: $$(jq '.puzzles | length' data/collected-puzzles.json)"
	@echo "Puzzle range: $$(jq -r '.puzzles | sort_by(.id) | [.[0].id, .[-1].id] | "First: \(.[0]), Last: \(.[1])"' data/collected-puzzles.json)"
	@echo ""
	@echo "Running scrapers:"
	@pgrep -af "daily-scraper" || echo "No scrapers running"

gaps:
	@echo "Analyzing collection for missing puzzles..."
	@jq -r '.puzzles | map(.id) | sort | @sh' data/collected-puzzles.json | \
	xargs bash -c 'ids=($$@); min=$${ids[0]}; max=$${ids[-1]}; \
	missing=(); \
	for ((i=min; i<=max; i++)); do \
		found=0; \
		for id in "$${ids[@]}"; do \
			if [ "$$id" = "$$i" ]; then found=1; break; fi; \
		done; \
		if [ $$found -eq 0 ]; then missing+=($$i); fi; \
	done; \
	if [ $${#missing[@]} -eq 0 ]; then \
		echo "✓ No gaps found! Collection is complete from $$min to $$max."; \
	else \
		echo "Found $${#missing[@]} missing puzzle(s) between $$min and $$max:"; \
		echo "$${missing[@]}"; \
	fi' --

scrape:
	@bash scripts/scrape-range.sh $(or $(DAYS),20)

resume:
	@bash scripts/resume-scraper.sh $(or $(DAYS),300)

retry:
	@node scripts/retry-puzzles.js $(IDS)

retry-missing:
	@node scripts/retry-missing.js
