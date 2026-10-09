# Course flows become course content; no PDFs are stored

Legacy course flows (about 158 PDFs/DOCX, mostly Arabic) are turned into structured course content (sessions, materials, notes) rather than stored as files. The site shows the full syllabus without a download, and no PDFs go to R2. Arabic text layers in these PDFs are unreliable (broken lam-alef, reversed or one-word-per-line text, lost tables), so pages are rendered to images and read by a vision LLM into the course schema. The output is saved as a draft with "needs review" status and its legacy URL.

## Considered Options

- **Keep the PDFs as attachments**: simpler, but the content can't be searched or localised, and it can't be read on a phone.
- **Text-layer extraction (pdfplumber, PyMuPDF)**: tested and rejected because the Arabic output was corrupted.
