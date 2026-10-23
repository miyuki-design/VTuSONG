import os
import plistlib
from pathlib import Path

team = os.environ.get('TEAM_ID', '')
if not team:
    raise SystemExit('GitHub Variable APPSTORE_TEAM_ID を設定してください')
bundle_id = 'com.miyukidesign.vtusong'
Path('.build').mkdir(exist_ok=True)
with Path('.build/ExportOptions.plist').open('wb') as f:
    plistlib.dump({
        'method': 'app-store-connect',
        'signingStyle': 'manual',
        'signingCertificate': 'Apple Distribution',
        'teamID': team,
        'provisioningProfiles': {bundle_id: f'AppStore {bundle_id}'},
        'uploadSymbols': True,
    }, f)
