#!/bin/bash
# Progressive load: autocannon against the local production build. Single sandbox machine shares CPU with the load generator, so numbers understate a real deployment.
AC=/tmp/qa-tools/node_modules/.bin/autocannon
for path in "/" "/courses" "/courses/personnel-licensing"; do
  for c in 10 50 100 250 500 1000; do
    $AC -c $c -d 10 -j "http://localhost:3100$path" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin); l=d['latency']
print('$path'.ljust(30),'$c'.rjust(5),'rps',round(d['requests']['average']),'p50',l['p50'],'p97.5',l['p97_5'],'p99',l['p99'],'max',l['max'],'ms | 2xx',d['2xx'],'non2xx',d['non2xx'],'errors',d['errors'],'timeouts',d['timeouts'])"
  done
done
