#!/bin/bash
# Trigger code analysis for AI Studio project

# Get auth token from container
TOKEN=$(docker exec vibe-studio-backend node -e "
  const http = require('http');
  const data = JSON.stringify({email:'admin@vibestudio.com',password:'admin123'});
  const req = http.request({hostname:'localhost',port:3000,path:'/api/auth/login',method:'POST',headers:{'Content-Type':'application/json','Content-Length':data.length}}, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      try { console.log(JSON.parse(body).accessToken); } catch(e) { }
    });
  });
  req.write(data);
  req.end();
")

if [ -z "$TOKEN" ]; then
  echo "Failed to get auth token"
  exit 1
fi

echo "Got auth token"

# Trigger analysis from inside container
RESPONSE=$(docker exec vibe-studio-backend node -e "
  const http = require('http');
  const token = '$TOKEN';
  const req = http.request({hostname:'localhost',port:3000,path:'/api/code-metrics/project/345a29ee-d6ab-477d-8079-c5dda0844d77/analyze',method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'}}, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => console.log(body));
  });
  req.end();
")

echo "Analysis triggered:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
