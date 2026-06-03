const http = require('http');
http.get('http://localhost:8081/', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log(data);
  });
}).on('error', (err) => console.log('HTTP GET error: ', err.message));
