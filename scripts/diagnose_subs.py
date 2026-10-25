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

# Compare two Wizdom releases with the same lines but opposite punctuation conventions.
def strip_marks(text):
 return "".join(c for c in text if c not in MARKS)
def decoded(data):
 if data.startswith(b"PK"):
  with zipfile.ZipFile(io.BytesIO(data)) as z:
   files=[x for x in z.namelist() if x.lower().endswith((".srt",".vtt"))]
   data=z.read(files[0])
 try:return data.decode("utf-8-sig")
 except UnicodeError:return data.decode("cp1255",errors="replace")
def body_lines(text):
 return [x.strip() for x in text.splitlines() if any("\u0590"<=c<="\u05ff" for c in x)]
def move_punctuation(line):
 s=strip_marks(line).strip()
 i=0
 while i<len(s) and s[i] in PUNCT:i+=1
 return s[i:]+s[:i] if i else s
def count(text):
 lines=body_lines(text)
 clean=[strip_marks(x).strip() for x in lines]
 return {"lines":len(lines),"prefix":sum(bool(x and x[0] in PUNCT) for x in clean),"suffix":sum(bool(x and x[-1] in PUNCT) for x in clean),"RLE":text.count("\u202b"),"PDF":text.count("\u202c"),"RLM":text.count("\u200f")}
try:
 data,_,_,_=get(SOURCES["Wizdom"]+PATH,1000000)
 heb=[s for s in json.loads(data)["subtitles"] if s.get("lang")=="heb"]
 versions=[]
 for sub in heb[:3]:
  data,_,_,_=get(sub["url"])
  versions.append(decoded(data))
  print("WIZDOM_VARIANT",str(sub["id"])[:65],json.dumps(count(versions[-1])),flush=True)
 if len(versions)>=3:
  left=body_lines(versions[0]);right=body_lines(versions[2])
  n=min(len(left),len(right))
  raw=sum(strip_marks(left[i])==strip_marks(right[i]) for i in range(n))
  moved=sum(move_punctuation(left[i])==strip_marks(right[i]).strip() for i in range(n))
  print("PAIRWISE_WIZDOM",json.dumps({"compared":n,"identicalWithoutMarks":raw,"identicalAfterMovingLeadingPunctuation":moved,"firstSixUnmatchedPatterns":[[mask(left[i]),mask(right[i])] for i in range(n) if move_punctuation(left[i])!=strip_marks(right[i]).strip()][:6]}),flush=True)
except Exception as e:
 print("COMPARE_ERROR",str(e)[:180],flush=True)

# Execute the proposed Node.js Apple TV normalizer on live downloaded files.
import subprocess
NODE_TEST=r"""
const fs=require('fs');
const {normalizeForAppleTv,subtitlePunctuationStats}=require('./lib/rtl');
const original=fs.readFileSync(0,'utf8');
const output=normalizeForAppleTv(original);
if(normalizeForAppleTv(output)!==output)process.exit(7);
process.stdout.write(JSON.stringify({before:subtitlePunctuationStats(original),after:subtitlePunctuationStats(output),unchanged:output===original,output:Buffer.from(output,'utf8').toString('base64')}));
"""
def normalize_live(text):
 p=subprocess.run(['node','-e',NODE_TEST],input=text,text=True,capture_output=True,timeout=10)
 if p.returncode!=0:raise RuntimeError("JS integration failed: "+p.stderr[:160])
 o=json.loads(p.stdout)
 import base64
 value=base64.b64decode(o.pop('output')).decode('utf8')
 return value,o
try:
 result,_,_,_=get(SOURCES["Wizdom"]+PATH,1000000)
 subs=[s for s in json.loads(result)["subtitles"] if s.get("lang")=="heb"]
 selected=[("wizdom_legacy",subs[0]["url"]),("wizdom_logical",subs[2]["url"])]
 result,_,_,_=get(SOURCES["Ktuvit"]+PATH,1000000)
 subs=[s for s in json.loads(result)["subtitles"] if s.get("lang")=="heb"]
 selected += [("ktuvit_legacy",subs[1]["url"])]
 result,_,_,_=get(SOURCES["OpenSubtitles"]+PATH,1000000)
 subs=[s for s in json.loads(result)["subtitles"] if s.get("lang")=="heb"]
 selected += [("opensubs_logical",subs[0]["url"])]
 normalized={}
 for name,url in selected:
  raw,_,_,_=get(url)
  converted,info=normalize_live(decoded(raw))
  normalized[name]=converted
  print("APPLE_NORMALIZE",name,json.dumps(info),flush=True)
 a=body_lines(normalized["wizdom_legacy"])
 b=body_lines(normalized["wizdom_logical"])
 total=min(len(a),len(b))
 print("APPLE_PAIRWISE",json.dumps({"compared":total,"normalizedIdenticalLines":sum(a[i]==b[i] for i in range(total)),"left":count(normalized["wizdom_legacy"]),"right":count(normalized["wizdom_logical"])}),flush=True)
except Exception as e:
 print("APPLE_NORMALIZE_ERROR",str(e)[:240],flush=True)
 raise

# Verify candidate RTL probe formats against real source SRTs without printing dialogue.
NODE_PROBE=r"""
const fs=require('fs');
const {toLogicalSrt,makeRlmSrt,makeRliSrt,makeRlmWebVtt}=require('./lib/probe');
const input=fs.readFileSync(0,'utf8');
const canonical=toLogicalSrt(input);
const rlm=makeRlmSrt(input);
const rli=makeRliSrt(input);
const vtt=makeRlmWebVtt(input);
for(const [fn,value] of [[toLogicalSrt,canonical],[makeRlmSrt,rlm],[makeRliSrt,rli],[makeRlmWebVtt,vtt]])
  if(fn(value)!==value)throw new Error('Probe mode not idempotent');
if(!vtt.startsWith('WEBVTT\n\n') && !vtt.startsWith('WEBVTT\n'))throw new Error('Missing WebVTT header');
if(!vtt.includes('align:start'))throw new Error('Missing WebVTT cue alignment');
const count=text=>({rlm:(text.match(/\u200f/g)||[]).length,rli:(text.match(/\u2067/g)||[]).length,timestamps:(text.match(/-->/g)||[]).length});
if(count(canonical).timestamps!==count(rlm).timestamps||count(rlm).timestamps!==count(vtt).timestamps)
  throw new Error('Cue count changed');
process.stdout.write(JSON.stringify({canonical:count(canonical),rlm:count(rlm),rli:count(rli),vtt:count(vtt)}));
"""
try:
 source_urls=[]
 for name,base,indices in [("Wizdom",SOURCES["Wizdom"],[0,2]),
                           ("Ktuvit",SOURCES["Ktuvit"],[1]),
                           ("OpenSubtitles",SOURCES["OpenSubtitles"],[0])]:
  response,_,_,_=get(base+PATH,1000000)
  items=[s for s in json.loads(response)["subtitles"] if str(s.get("lang","")).lower() in ("he","heb","iw")]
  for idx in indices:
   if len(items)>idx:source_urls.append((name+"_"+str(idx),items[idx]["url"]))
 for name,url in source_urls:
  raw,_,_,_=get(url)
  p=subprocess.run(['node','-e',NODE_PROBE],input=decoded(raw),text=True,capture_output=True,timeout=10)
  if p.returncode:raise RuntimeError(name+": "+p.stderr[:200])
  print("PROBE_LIVE",name,p.stdout,flush=True)
except Exception as e:
 print("PROBE_LIVE_ERROR",str(e)[:250],flush=True)
 raise
