# Virtual Environment Location

## Unified Virtual Environment Location

**All Python virtual environments MUST be located at:**
```
src/server/.venv
```

## Why This Location?

1. **Server Code Location**: All backend Python code is in `src/server/`
2. **Consistency**: Keeps virtual environment close to the code it serves
3. **Workspace Support**: Works with `pyproject.toml` workspace configuration
4. **Clear Separation**: Keeps root directory clean

## Creating the Virtual Environment

### Using uv (Recommended)

```powershell
cd src\server
uv venv .venv
uv pip install -r requirements.txt
```

### Using Python venv

```powershell
cd src\server
python -m venv .venv
.\.venv\Scripts\activate.ps1
pip install -r requirements.txt
```

## Script Behavior

The `start_all_services.ps1` script will:
1. Always check for virtual environment at `src/server/.venv`
2. Create it there if it doesn't exist (when using uv)
3. Use this location consistently throughout the script

## Important Notes

- **DO NOT** create virtual environments in the project root
- **DO NOT** use `venv` (without dot) - use `.venv` (with dot)
- The script will automatically handle virtual environment creation and dependency installation

