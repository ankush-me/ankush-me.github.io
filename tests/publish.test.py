"""Exercise snapshot publishing entirely against temporary local repositories."""
from pathlib import Path
import os
import shutil
import subprocess
import tempfile

SCRIPT = Path(__file__).resolve().parents[1] / 'commit-reset.sh'


def run(cwd, *args):
    return subprocess.run(args, cwd=cwd, check=True, capture_output=True,
                          text=True, timeout=30, env={**os.environ, 'GIT_CONFIG_GLOBAL': os.devnull,
                          'GIT_CONFIG_NOSYSTEM': '1'}).stdout.strip()


def git(cwd, *args):
    return run(cwd, 'git', '-c', 'core.hooksPath=/dev/null',
               '-c', 'commit.gpgSign=false', *args)


with tempfile.TemporaryDirectory(prefix='site-publish-test-') as tmp:
    root = Path(tmp)
    source = root / 'source with spaces'
    source.mkdir()
    remote = root / 'public.git'
    git(root, 'init', '--quiet', '--bare', '--template=', str(remote))
    git(source, 'init', '--quiet', '--template=')
    git(source, 'config', 'user.name', 'Snapshot Test')
    git(source, 'config', 'user.email', 'snapshot@example.invalid')
    git(source, 'remote', 'add', 'origin', str(remote))
    shutil.copy2(SCRIPT, source / SCRIPT.name)
    (source / '.gitignore').write_text('/lab/\n')
    (source / 'index.html').write_text('private draft')
    (source / 'deleted.txt').write_text('obsolete')
    git(source, 'add', '.')
    git(source, 'commit', '--quiet', '-m', 'Private editing history')
    (source / 'index.html').write_text('staged draft')
    git(source, 'add', 'index.html')
    (source / 'index.html').write_text('public version one')
    (source / 'deleted.txt').unlink()
    (source / 'new file.txt').write_text('new asset')
    (source / 'lab').mkdir()
    (source / 'lab' / 'private.txt').write_text('local experiment')

    local_head = git(source, 'rev-parse', 'HEAD')
    local_index = (source / '.git' / 'index').read_bytes()
    preview = run(source, 'bash', './commit-reset.sh', '--dry-run')
    assert 'new file.txt' in preview
    assert 'lab/private.txt' not in preview
    assert 'deleted.txt' not in preview
    assert not git(remote, 'for-each-ref'), 'dry run must not publish'

    tips = []
    for content in ('public version one', 'public version two'):
        if tips:
            git(source, 'config', '--unset', 'user.name')
            git(source, 'config', '--unset', 'user.email')
        (source / 'index.html').write_text(content)
        run(source, 'bash', './commit-reset.sh')
        tip = git(remote, 'rev-parse', 'refs/heads/main')
        tips.append(tip)
        assert git(remote, 'rev-list', '--count', tip) == '1'
        assert len(git(remote, 'rev-list', '--parents', '-n', '1', tip).split()) == 1
        assert git(remote, 'show', f'{tip}:index.html') == content
        assert git(remote, 'show', '-s', '--format=%an <%ae>', tip) == 'Snapshot Test <snapshot@example.invalid>'
        files = git(remote, 'ls-tree', '-r', '--name-only', tip).splitlines()
        assert 'new file.txt' in files
        assert not any(name.startswith('lab/') for name in files)
        assert 'deleted.txt' not in files
        assert git(source, 'rev-parse', 'HEAD') == local_head
        assert (source / '.git' / 'index').read_bytes() == local_index
        assert (source / 'lab' / 'private.txt').read_text() == 'local experiment'
    assert tips[0] != tips[1]

print('Passed: offline dry run, repeated single-commit snapshots, ignored/deleted files, '
      'working edits, new files, paths with spaces, and preserved local history/staging.')
