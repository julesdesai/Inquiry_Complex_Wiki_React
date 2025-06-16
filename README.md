# Graph Wiki - Inquiry Complex Explorer

A React-based web application for exploring inquiry complexes - dialectical tree structures derived from philosophical texts and questions.

## Features

- **Graph Selection**: Browse and select from predefined question and text graphs
- **Text Upload**: Upload plain text files to automatically generate inquiry complexes
- **Interactive Navigation**: Explore dialectical structures with questions, theses, antitheses, syntheses, and more
- **Firebase Integration**: Data persistence using Firestore
- **Dynamic Collections**: Automatically created collections for uploaded texts

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- Python 3.x
- Firebase project setup

### Installation

1. Install dependencies:
```bash
npm install
```

2. Install Python dependencies for text processing:
```bash
pip install -r requirements.txt  # If requirements.txt exists
```

3. Set up Firebase configuration in `src/firebase.js`

### Running the Application

#### Development Mode

To run both the React frontend and Express backend:
```bash
npm run dev
```

This will start:
- React app on http://localhost:3000
- Express server on http://localhost:3001

#### Individual Services

Frontend only:
```bash
npm start
```

Backend only:
```bash
npm run server
```

## Usage

### Browsing Existing Graphs

1. Launch the application
2. Select from available graphs in the "Questions" or "Texts" sections
3. Navigate through the inquiry complex using the interactive interface

### Uploading New Texts

1. Click "Upload New Text" on the main selection screen
2. Enter a name and description for your text
3. Either upload a .txt file or paste text content directly
4. Click "Upload and Process" to generate the inquiry complex
5. The system will automatically:
   - Process the text using the Python script
   - Generate a dialectical structure
   - Upload to Firebase
   - Navigate to the new collection

## Architecture

### Frontend (React)
- `src/App.js` - Main application with routing and state management
- `src/components/GraphSelection.js` - Graph selection interface
- `src/components/TextUpload.js` - Text upload interface
- `src/components/NodePage.js` - Individual node display and navigation
- `src/firebase.js` - Firebase integration and database operations

### Backend (Express)
- `server.js` - Express server handling text processing requests
- `src/python/text_to_IC.py` - Python script for generating inquiry complexes

### Data Flow
1. User uploads text → Express server
2. Server saves text to temp file → calls Python script
3. Python script processes text → returns JSON structure
4. Server returns processed data → React frontend
5. Frontend uploads to Firebase → updates local config
6. User can immediately navigate to new collection

## File Structure

```
graph-wiki/
├── public/
│   ├── prompts/          # AI prompts for text processing
│   └── ...
├── src/
│   ├── components/       # React components
│   ├── services/         # API services
│   ├── python/          # Python text processing
│   ├── firebase.js      # Firebase configuration
│   └── App.js
├── server.js            # Express backend
└── package.json
```

## Configuration

### Adding New Static Graphs

Edit `src/App.js` and `src/components/GraphSelection.js`:

1. Add root node ID to `ROOT_NODE_CONFIG` in App.js
2. Add graph metadata to `QUESTION_GRAPH_CONFIG` or `TEXT_GRAPH_CONFIG` in GraphSelection.js

### Python Script Configuration

The text processing script can be configured in `src/python/text_to_IC.py`:
- `max_depth`: Maximum dialectical tree depth
- `top_n_questions`: Number of questions to explore
- Prompt templates in `public/prompts/`

## Troubleshooting

### Common Issues

1. **Python script not found**: Ensure Python 3 is installed and available as `python3`
2. **Firebase permissions**: Check Firebase security rules and authentication
3. **Port conflicts**: Ensure ports 3000 and 3001 are available
4. **File upload errors**: Check file permissions in temp directory

### Logs

- React app logs: Browser console
- Express server logs: Terminal running `npm run server`
- Python script logs: Server terminal stderr output

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Test thoroughly
5. Submit a pull request

## License

[Your license here]