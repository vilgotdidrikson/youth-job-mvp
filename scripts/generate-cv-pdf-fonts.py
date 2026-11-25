# Derive static PDF-compatible faces from the pinned Inter Latin asset.
# Requires fontTools and Node.js (Node supplies Brotli decoding; no font download).
import sys,types,subprocess,json,hashlib
from pathlib import Path
bridge=types.ModuleType('brotli')
def decompress(data):
 return subprocess.run(['node','-e',"const fs=require('fs'),z=require('zlib');process.stdout.write(z.brotliDecompressSync(fs.readFileSync(0)));"],input=data,stdout=subprocess.PIPE,check=True).stdout
bridge.decompress=decompress
sys.modules['brotli']=bridge
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
for weight,name in [(400,'regular'),(600,'semibold')]:
 font=TTFont('public/fonts/inter-latin.woff2')
 font=instantiateVariableFont(font,{'wght':weight},inplace=True)
 font.flavor=None
 font.recalcTimestamp=False
 subfamily='Regular' if weight==400 else 'SemiBold'
 labels={1:'Inter',2:subfamily,3:'MatchnWork-Inter-PDF-'+subfamily,4:'Inter '+subfamily,6:'Inter-'+subfamily,16:'Inter',17:subfamily}
 for record in font['name'].names:
  if record.nameID in labels: record.string=labels[record.nameID]
 font.save(f'public/fonts/cv-inter-{name}.ttf')

source=Path('public/fonts/inter-latin.woff2')
faces=[{'file':f'cv-inter-{name}.ttf','weight':weight,'sha256':hashlib.sha256(Path(f'public/fonts/cv-inter-{name}.ttf').read_bytes()).hexdigest()} for name,weight in [('regular',400),('semibold',600)]]
Path('public/fonts/cv-manifest.json').write_text(json.dumps({'source':source.name,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'license':'inter-OFL.txt','faces':faces},indent=2)+'\n')
