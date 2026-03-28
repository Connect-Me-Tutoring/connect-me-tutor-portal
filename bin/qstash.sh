curl -XPOST \
    -H 'Authorization: Bearer eyJVc2VySUQiOiIyMjg5NjcwNy1hZWRjLTRlMTMtODllNS04ODE2OWQwM2IzZDUiLCJQYXNzd29yZCI6IjFiODA3NmMxMDhjYjRhNzRiOWM3ZTBmZTJmNDE2NjRjIn0=' \
    -H "Content-type: application/json" \
    -d '{ "hello": "world" }' \
    'https://qstash.upstash.io/v2/publish/https://qstash-eu-central-1.upstash.io'