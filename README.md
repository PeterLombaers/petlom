# Petlom

## Development

- Start the backend server: `uv run fastapi dev backend/main.py`
- Start the frontend server: `cd frontend && npm install && npm run dev`
- (Optional) Fill the database with fake data: `uv run python fill_db.py`

There is a VSCode tasks file at https://gist.github.com/PeterLombaers/0f896b05ecdaba6ff718f815b323ce71 that you can use to run these commands. Simply add it to your `.vscode` folder, use `Ctrl+Shift+p` and select `Tasks: Run Task`.

## Typescript API client

The typescrip API client is generated using `openapi-typescript`. It uses the OpenAPI definition that FastAPI outputs to generate typescript types for the backend API. These types are located at `frontend/src/client/schema.d.ts`. You never need to manually edit this file, instead you can use the command `npm run generate-client` from the frontend directory, or you can run the corresponding VSCode Task.
