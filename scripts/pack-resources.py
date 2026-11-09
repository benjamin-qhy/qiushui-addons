"""Build self-contained resource tarballs; does not publish curated metadata."""
import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import tarfile

KINDS = ('addons', 'skills', 'employees', 'pi-extensions', 'connectors', 'mcps')
SLUG = re.compile(r'^[a-z0-9][a-z0-9-]{0,63}$')
VERSION = re.compile(r'^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$')
FORBIDDEN = {'memory', 'sessions', '.git', 'node_modules', '.env', '.DS_Store'}

def package(directory, kind):
    manifest = json.loads((directory / 'resource.json').read_text())
    slug, version = manifest['id'], manifest['version']
    if manifest.get('schemaVersion') != 1 or manifest.get('kind') != kind or slug != directory.name or not SLUG.fullmatch(slug) or not VERSION.fullmatch(version):
        raise ValueError(f'Invalid resource manifest: {directory}')
    required = {'addons': ['package.json', 'LICENSE', 'SOURCE.md'], 'skills': ['SKILL.md', 'LICENSE', 'SOURCE.md'], 'employees': ['agent.json', 'AGENTS.md', 'capabilities.json'], 'pi-extensions': ['package.json', 'LICENSE', 'SOURCE.md'], 'connectors': ['package.json', 'LICENSE', 'SOURCE.md'], 'mcps': ['mcp.json', 'README.md']}[kind]
    for name in required:
        if not (directory / name).is_file():
            raise ValueError(f'Missing required file: {directory / name}')
    if kind == 'employees':
        policy = json.loads((directory / 'capabilities.json').read_text())
        if policy.get('localApprovals'):
            raise ValueError('Employee package must not contain local approvals')
        agent = json.loads((directory / 'agent.json').read_text())
        if agent.get('storage_slug') != slug or agent.get('avatar') not in ('avatar.jpg', 'avatar.png', 'avatar.webp'):
            raise ValueError('Employee identity/avatar mismatch')
        if not (directory / agent['avatar']).is_file():
            raise ValueError('Missing employee avatar')
    files = []
    total = 0
    for path in sorted(directory.rglob('*')):
        relative = path.relative_to(directory)
        if kind == "addons" and (any(part in {"tests", "assets", ".tmp"} for part in relative.parts) or path.name.endswith((".test.ts", ".test.tsx")) or path.name == "bunfig.toml"):
            continue
        if path.is_symlink() or any(part in FORBIDDEN or part.startswith('.env.') for part in relative.parts):
            raise ValueError(f'Forbidden package entry: {relative}')
        if path.is_dir():
            continue
        if not path.is_file():
            raise ValueError(f'Not a regular file: {relative}')
        data = path.read_bytes()
        total += len(data)
        files.append((path, relative, data))
    if total > 16 * 1024 * 1024 or len(files) > 1024:
        raise ValueError('Resource exceeds installer limits')
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode='w', format=tarfile.USTAR_FORMAT) as archive:
        for path, relative, data in files:
            info = tarfile.TarInfo('package/' + relative.as_posix())
            info.size = len(data)
            info.mode = 0o755 if path.stat().st_mode & 0o111 else 0o644
            info.mtime = 0
            archive.addfile(info, io.BytesIO(data))
    # gzip.compress(mtime=0) delegates its OS byte to zlib on Python 3.11/12,
    # producing different checksums on macOS and Linux. GzipFile consistently
    # writes OS=unknown; pin the compression level as well.
    compressed = io.BytesIO()
    with gzip.GzipFile(filename='', mode='wb', fileobj=compressed, compresslevel=9, mtime=0) as stream:
        stream.write(raw.getvalue())
    packed = compressed.getvalue()
    return f'haiqiai-{kind}-{slug}-{version}.tgz', packed

def build(root, output):
    output.mkdir(parents=True, exist_ok=True)
    records = []
    # Validate everything before writing any release package.
    pending = [package(p, kind) for kind in KINDS if (root / kind).exists() for p in sorted((root / kind).iterdir()) if p.is_dir() and (p / "resource.json").is_file()]
    # Avatars use immutable URLs too, so curated cards can display them before installation.
    for directory in sorted((root / 'employees').iterdir()) if (root / 'employees').exists() else []:
        if directory.is_dir():
            manifest = json.loads((directory / 'resource.json').read_text())
            agent = json.loads((directory / "agent.json").read_text())
            avatar = directory / agent["avatar"]
            pending.append((f"haiqiai-employees-{manifest['id']}-{manifest['version']}-avatar{avatar.suffix}", avatar.read_bytes()))
    for name, data in pending:
        target = output / name
        if target.exists() and target.read_bytes() != data:
            raise ValueError(f'Version is immutable; bump resource version: {name}')
    for name, data in pending:
        (output / name).write_bytes(data)
        records.append({'file': name, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)})
    return records

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'docs/packages')
    args = parser.parse_args()
    print(json.dumps(build(Path(__file__).resolve().parents[1], args.output), indent=2))
