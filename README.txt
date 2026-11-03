Portfolio Assist prototype

This revision follows the approved screenshot from 31 October 2026 as the visual source of truth.

Files:
- index.html: root landing page
- assets/css/style.css: all custom styles (external stylesheet)
- assets/js/script.js: chat API client and progressive portfolio rendering
- assets/images/hero-portrait.webp: portrait artwork used in the approved design
- traditionalview/README.txt: instructions for adding the existing traditional portfolio
- knowledge/: approved portfolio content used by the dynamic sections

Desktop:
- Two-column composition matching the approved screenshot.
- Main portfolio area uses two-thirds of the viewport; assistant uses one-third.
- Portfolio and assistant content scroll independently.
- On smaller screens, the portfolio panel and assistant are stacked; the portfolio retains its own scroll area.
- Project cards use keyboard-accessible expand/collapse controls. The complete Time Off case study is sourced from the existing Traditional View modal.

Important:
- Chat responses are provided by the configured Cloudflare Worker. Do not place API credentials in frontend files.
- Portfolio sections accumulate as visitors explore. Project details are limited to approved knowledge and local assets; Evolution's UX progression is a conceptual framework, not a claim that all described capabilities were implemented.
- Traditional View remains available as a separate navigation option.
