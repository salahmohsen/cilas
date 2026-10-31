# Course flows become course content; no PDFs are stored

Legacy course flows (about 158 PDFs/DOCX, mostly Arabic) are turned into structured course content (sessions, materials, notes) rather than stored as files. The site shows the full syllabus without a download, and no PDFs go to R2. Arabic text layers in these PDFs are unreliable (broken lam-alef, reversed or one-word-per-line text, lost tables), so pages are rendered to images and read by a vision LLM into the course schema. The output is saved as a draft with "needs review" status and its legacy URL.

## Considered Options

- **Keep the PDFs as attachments**: simpler, but the content can't be searched or localised, and it can't be read on a phone.
- **Text-layer extraction (pdfplumber, PyMuPDF)**: tested and rejected because the Arabic output was corrupted.

## Outcome (2026-10-11)

A benchmark of the 160 flow PDFs found:

- **English flows (140):** text layers that read cleanly, apart from any Arabic they quote. That Arabic comes out reversed.
- **Arabic flows (20):** broken text layers. The lam-alef ligature is reversed, word spaces are missing, and punctuation is displaced.
- **Scans:** none.

What was done about it:

- Tesseract (`ara`) reads Arabic prose correctly but scrambles tables. So Arabic flows, and the Arabic inside English flows, are read from page images, with the text layer or OCR as a helper.
- The extraction ran on Claude Code agents. Every link from the PDFs' annotations was checked into the result.
