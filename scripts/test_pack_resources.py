import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('pack_resources', Path(__file__).with_name('pack-resources.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ResourcePackaging(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='haiqiai-resource-package-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.skill = self.root / 'skills' / 'example'
        self.skill.mkdir(parents=True)
        for name, content in {'SKILL.md': '---\nname: example\n---\nExample', 'LICENSE': 'MIT', 'SOURCE.md': 'Source', 'resource.json': json.dumps({'schemaVersion': 1, 'kind': 'skills', 'id': 'example', 'version': '1.0.0'})}.items():
            (self.skill / name).write_text(content)

    def test_deterministic_and_immutable(self):
        first = module.build(self.root, self.root / 'output')
        self.assertEqual(first, module.build(self.root, self.root / 'output'))
        (self.skill / 'SKILL.md').write_text('changed')
        with self.assertRaisesRegex(ValueError, 'immutable'):
            module.build(self.root, self.root / 'output')

    def test_rejects_symlinks(self):
        (self.skill / 'outside').symlink_to(self.root / 'outside')
        with self.assertRaisesRegex(ValueError, 'Forbidden'):
            module.build(self.root, self.root / 'output')

    def test_rejects_runtime_data_before_writing(self):
        (self.skill / 'memory').mkdir()
        with self.assertRaisesRegex(ValueError, 'Forbidden'):
            module.build(self.root, self.root / 'output')
        self.assertEqual(list((self.root / 'output').iterdir()), [])

    def test_employee_avatar_is_versioned_and_immutable(self):
        employee = self.root / 'employees' / 'example'
        employee.mkdir(parents=True)
        for name, value in {
            'resource.json': {'schemaVersion': 1, 'kind': 'employees', 'id': 'example', 'version': '1.0.0'},
            'agent.json': {'storage_slug': 'example', 'avatar': 'avatar.jpg'},
            'capabilities.json': {'localApprovals': []},
        }.items():
            (employee / name).write_text(json.dumps(value))
        (employee / 'AGENTS.md').write_text('Employee instructions')
        (employee / 'avatar.jpg').write_bytes(b'avatar-fixture')
        output = self.root / 'output'
        module.build(self.root, output)
        avatar = output / 'haiqiai-employees-example-1.0.0-avatar.jpg'
        self.assertEqual(avatar.read_bytes(), b'avatar-fixture')
        avatar.write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError, 'immutable'):
            module.build(self.root, output)

    def test_requires_license(self):
        (self.skill / 'LICENSE').unlink()
        with self.assertRaisesRegex(ValueError, 'Missing required'):
            module.build(self.root, self.root / 'output')

if __name__ == '__main__':
    unittest.main()
