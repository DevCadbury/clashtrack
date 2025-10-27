# COC Clan Checker v2

## 🚀 How to Run
1. Extract this ZIP.
2. Open a terminal inside the folder.
3. Run:
   ```bash
   npm install
   ```
4. Create a `.env` file in the same folder with your COC token:
   ```bash
   COC_API_TOKEN=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiIsImtpZCI6IjI4YTMxOGY3LTAwMDAtYTFlYi03ZmExLTJjNzQzM2M2Y2NhNSJ9.eyJpc3MiOiJzdXBlcmNlbGwiLCJhdWQiOiJzdXBlcmNlbGw6Z2FtZWFwaSIsImp0aSI6ImI1Mzk0Y2QxLTk2N2YtNGU4ZS04YmY3LTIyMTgxNmI3MjZlZSIsImlhdCI6MTc2MTQ3NzIyNSwic3ViIjoiZGV2ZWxvcGVyL2E0NjZjZTM3LWQ3YmQtOGMyYS0xM2FhLTY0ZjY3YmQ1NDIxYSIsInNjb3BlcyI6WyJjbGFzaCJdLCJsaW1pdHMiOlt7InRpZXIiOiJkZXZlbG9wZXIvc2lsdmVyIiwidHlwZSI6InRocm90dGxpbmcifSx7ImNpZHJzIjpbIjE1Mi41OC4xMTkuMTU3Il0sInR5cGUiOiJjbGllbnQifV19.CPq0E2XJ7-TdAvlWtSsFwjnJz90b6famBET8wpvfkty4E77l-MMoUk57u2Mn3FYmTiTFVtBb9-Z004WOPK4Grg
   ```
5. Start the server:
   ```bash
   node server.js
   ```
6. Open in browser:
   - API: http://localhost:3000/api/players
   - Status: http://localhost:3000

Updates automatically every 5 minutes and logs all player details.
