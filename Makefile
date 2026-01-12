# Makefile for quotation-app
# Usage examples:
#   make bom-pdf QUOTATION_JSON=path/to/quotation.json QUOTE_REF=PQ25100000
#   make help

NODE := node
SCRIPT_DIR := backend/scripts
BOM_SCRIPT := $(SCRIPT_DIR)/generate-bom-pdf.js
BOM_DIR := backend/pdf/bom

.PHONY: help bom-pdf bom-dir

help:
	@echo "Targets:"
	@echo "  bom-pdf QUOTATION_JSON=<file> QUOTE_REF=<PQyymmxxxx> [STRIP_PQ=1]  Generate BOM-only PDF under $(BOM_DIR)"
	@echo "Variables:"
	@echo "  QUOTATION_JSON  Path to quotation JSON input (required)"
	@echo "  QUOTE_REF       Quotation ref, used in filename (e.g., PQ25100000). If absent, taken from JSON"
	@echo "  STRIP_PQ        If 1, drop the leading 'PQ' in the filename (e.g., bom_25100000.pdf)"

bom-dir:
	@mkdir -p $(BOM_DIR)

bom-pdf: bom-dir
ifndef QUOTATION_JSON
	$(error QUOTATION_JSON is required. Example: make bom-pdf QUOTATION_JSON=backend/sample.json QUOTE_REF=PQ25100000)
endif
	$(NODE) $(BOM_SCRIPT) --json "$(QUOTATION_JSON)" $(if $(QUOTE_REF),--ref "$(QUOTE_REF)") $(if $(filter 1 true,$(STRIP_PQ)),--strip-pq)
