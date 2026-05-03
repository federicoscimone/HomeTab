#!/bin/bash
# Quick setup script per i dati demo
# Uso: bash seed-demo.sh [1 | 12]

set -e

if [ -z "$1" ]; then
  echo "❌ Uso: bash seed-demo.sh [1 | 12]"
  echo ""
  echo "  1   — Dataset 1 mese (maggio 2026)"
  echo "  12  — Dataset 12 mesi 2025+2026 con confronto ⭐"
  exit 1
fi

if [ "$1" != "1" ] && [ "$1" != "12" ]; then
  echo "❌ Argomento non valido: $1  (usa 1 oppure 12)"
  exit 1
fi

echo "📚 Seed dati demo per HomeTab..."
echo ""

echo "Step 1: Seed categorie e keyword base"
node lib/seed-simple.js
echo ""

if [ "$1" = "1" ]; then
  echo "Step 2: Inserisci dati demo famiglia (1 mese - maggio 2026)"
  node lib/seed-demo-family.js
elif [ "$1" = "12" ]; then
  echo "Step 2a: Anno 2025"
  node lib/seed-demo-family-12months.js 2025
  echo ""
  echo "Step 2b: Anno 2026"
  node lib/seed-demo-family-12months.js 2026
fi
echo ""

echo "Step 3: Keyword mapping estesi"
node lib/seed-keywords-demo.js
echo ""

echo "✅ Done!"
