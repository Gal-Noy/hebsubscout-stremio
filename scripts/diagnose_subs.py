#!/usr/bin/env python3
"""Analyze public S02E04 subtitle files; redact dialogue in public logs."""
import io,json,urllib.request,urllib.parse,zipfile
SOURCES={
 "Wizdom":"https://4b139a4b7f94-wizdom-stremio-v2.baby-beamup.club",
 "Ktuvit":"https://4b139a4b7f94-ktuvit-stremio.baby-beamup.club",
 "OpenSubtitles":"https://opensubtitles-v3.strem.io"
}
PATH="/subtitles/series/tt1190634:2:4.json"
MARKS=set("\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069")
PUNCT=set("?!.,:;()[]{}\u2026")
def get(url,limit=3000000):
 req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 Stremio subtitle diagnostics"})
 with urllib.request.urlopen(req,timeout=12) as r:
  return r.read(limit+1),r.status,r.getheader("Content-Type",""),r.geturl()
def mask(line):
 out=[]
 for c in line[:100]:
  if "\u0590"<=c<="\u05ff":out.append("H")
  elif c in MARKS:out.append("[U+%04X]"%ord(c))
  elif c.isalpha():out.append("L")
  elif c.isdigit():out.append("#")
  else:out.append(c)
 return "".join(out)
def analyze(data):
 zipped=data.startswith(b"PK")
 if zipped:
  with zipfile.ZipFile(io.BytesIO(data)) as z:
   files=[x for x in z.namelist() if x.lower().endswith((".srt",".vtt"))]
   if not files:return {"error":"ZIP contains no SRT/VTT","members":z.namelist()[:5]}
   data=z.read(files[0])
 if data.startswith(b"\xff\xfe"):txt=data[2:].decode("utf-16le");enc="utf-16le"
 elif data.startswith(b"\xfe\xff"):txt=data[2:].decode("utf-16be");enc="utf-16be"
 else:
  try:txt=data.decode("utf-8-sig");enc="utf-8"
  except UnicodeError:txt=data.decode("cp1255",errors="replace");enc="cp1255"
 lines=[x.strip() for x in txt.splitlines() if any("\u0590"<=c<="\u05ff" for c in x)]
 return {"zip":zipped,"size":len(data),"encoding":enc,"format":"vtt" if txt.startswith("WEBVTT") else "srt" if "-->" in txt else "unknown","hebrewLines":len(lines),"bidiMarked":sum(any(c in MARKS for c in x) for x in lines),"leadingPunctuation":sum(x[0] in PUNCT for x in lines),"trailingPunctuation":sum(x[-1] in PUNCT for x in lines),"firstMaskedLines":[mask(x) for x in lines[:5]]}
for name,base in SOURCES.items():
 print("SOURCE",name,flush=True)
 try:
  raw,status,ctype,url=get(base+PATH,1000000);subs=json.loads(raw).get("subtitles",[])
  heb=[s for s in subs if str(s.get("lang","")).lower() in ("heb","he","iw") and str(s.get("url","")).startswith("https://")]
  print("INDEX",status,"total",len(subs),"hebrew",len(heb),flush=True)
 except Exception as e:
  print("INDEX_ERROR",str(e)[:180],flush=True)
  continue
 for sub in heb[:3]:
  url=sub["url"]
  print("SUB",str(sub.get("id",""))[:90],"downloadHost",urllib.parse.urlsplit(url).netloc,flush=True)
  try:
   data,status,ct,_=get(url)
   if len(data)>3000000:print("FILE_TOO_LARGE")
   else:print("FILE",status,ct,json.dumps(analyze(data),ensure_ascii=False),flush=True)
  except Exception as e:print("FILE_ERROR",str(e)[:180],flush=True)
