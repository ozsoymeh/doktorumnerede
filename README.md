# Docfinder Türk

Eine Webanwendung zur Suche nach türkischen Ärzten in Wien.

## Installation

1. Abhängigkeiten installieren:
```bash
npm install
```

2. Umgebungsvariablen konfigurieren:
- Kopieren Sie `.env.example` zu `.env`
- Passen Sie die Variablen nach Bedarf an

3. Tailwind CSS kompilieren:
```bash
npm run build:css
```

4. Server starten:
```bash
# Entwicklungsmodus mit automatischem Neuladen
npm run dev

# Produktionsmodus
npm start
```

## Technologien

- Node.js
- Express.js
- Tailwind CSS
- EJS Templates
- XLSX für Excel-Dateiverarbeitung

## Projektstruktur

```
docfinder-turk/
├── public/
│   └── css/
│       ├── input.css
│       └── output.css
├── views/
│   └── index.ejs
├── server.js
├── package.json
├── tailwind.config.js
└── .env
``` 