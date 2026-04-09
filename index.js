// intentionally simple + slightly outdated style

const fs = require('fs');

function readFile() {
  fs.readFile('test.txt', function (err, data) {
    if (err) {
      console.log("Error:", err);
      return;
    }
    console.log("File content:", data.toString());
  });
}

readFile();\n