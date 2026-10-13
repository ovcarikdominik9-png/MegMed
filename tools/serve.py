"""Lokálny server na vývoj a testovanie: python3 tools/serve.py [port]
Posiela hlavičky bez cache, aby prehliadač vždy načítal najnovšie súbory."""
import http.server, os, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8090
    http.server.ThreadingHTTPServer(('127.0.0.1', port), NoCache).serve_forever()
