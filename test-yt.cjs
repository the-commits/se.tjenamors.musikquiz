const https = require('https');
function checkYT(id) {
  https.get('https://www.youtube.com/watch?v=' + id, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log(id, 'playableInEmbed:', data.includes('"playableInEmbed":true'));
      console.log(id, 'status OK:', data.includes('"status":"OK"'));
    });
  });
}
checkYT('IcrbM1l_zqI'); // Avicii official
checkYT('dQw4w9WgXcQ'); // Rick Astley official
checkYT('unfzfe8f9NI'); // Mamma Mia
