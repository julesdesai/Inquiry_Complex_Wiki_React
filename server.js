const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'build')));
}

const PYTHON_SCRIPT_PATH = path.join(__dirname, 'src', 'python', 'text_to_IC.py');
const TEMP_DIR = path.join(__dirname, 'temp');

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

app.post('/api/process-text', async (req, res) => {
  const { name, author, description, textContent } = req.body;

  if (!name || !textContent) {
    return res.status(400).json({
      success: false,
      error: 'Name and text content are required'
    });
  }

  const tempFileName = `${Date.now()}_${name.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
  const tempFilePath = path.join(TEMP_DIR, tempFileName);

  try {
    fs.writeFileSync(tempFilePath, textContent, 'utf8');
    
    console.log(`Starting Python script for: ${name} by ${author || 'Unknown'}`);
    console.log(`File: ${tempFilePath}`);
    console.log(`Command: python3 ${PYTHON_SCRIPT_PATH} ${tempFilePath} "${name}" "${description || ''}" "${author || ''}"`);

    const pythonProcess = spawn('python3', [PYTHON_SCRIPT_PATH, tempFilePath, name, description || '', author || ''], {
      cwd: path.dirname(PYTHON_SCRIPT_PATH)
    });

    let stdoutData = '';
    let stderrData = '';

    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
      console.log('[Python stdout]:', data.toString());
    });

    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
      console.log('[Python stderr]:', data.toString());
    });

    pythonProcess.on('close', (code) => {
      fs.unlinkSync(tempFilePath);

      if (code !== 0) {
        console.error('Python script error:', stderrData);
        return res.status(500).json({
          success: false,
          error: `Python script failed with code ${code}: ${stderrData}`
        });
      }

      try {
        const outputLines = stdoutData.trim().split('\n');
        const jsonLine = outputLines.find(line => line.startsWith('JSON_OUTPUT:'));
        
        if (!jsonLine) {
          throw new Error('No JSON output found from Python script');
        }

        const jsonOutput = JSON.parse(jsonLine.replace('JSON_OUTPUT:', ''));

        res.json({
          success: true,
          data: {
            name,
            author,
            description,
            collectionName: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            inquiryComplex: jsonOutput,
            metadata: {
              name: name,
              author: author,
              description: description,
              createdAt: new Date().toISOString(),
              nodeCount: Object.keys(jsonOutput).length,
              textLength: textContent.length
            }
          }
        });
      } catch (parseError) {
        console.error('JSON parsing error:', parseError);
        res.status(500).json({
          success: false,
          error: `Failed to parse Python script output: ${parseError.message}`
        });
      }
    });

    pythonProcess.on('error', (error) => {
      fs.unlinkSync(tempFilePath);
      console.error('Python process error:', error);
      res.status(500).json({
        success: false,
        error: `Failed to start Python script: ${error.message}`
      });
    });

  } catch (error) {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    console.error('File processing error:', error);
    res.status(500).json({
      success: false,
      error: `File processing failed: ${error.message}`
    });
  }
});

// Serve React app for all other routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;