# Petlom

## Development

- Start the backend server: `uv run fastapi dev backend/main.py`
- Start the frontend server: `cd frontend && npm install && npm run dev`
- (Optional) Fill the database with fake data: `uv run python fill_db.py`

There is a VSCode tasks file at https://gist.github.com/PeterLombaers/0f896b05ecdaba6ff718f815b323ce71 that you can use to run these commands. Simply add it to your `.vscode` folder, use `Ctrl+Shift+p` and select `Tasks: Run Task`.
