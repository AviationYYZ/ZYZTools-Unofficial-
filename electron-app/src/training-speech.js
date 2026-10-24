// Windows System.Speech: local synthesis, synchronous completion, no browser/cloud TTS.
const {spawn}=require('node:child_process');
const encode=s=>Buffer.from(s,'utf16le').toString('base64'),literal=s=>"[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('"+Buffer.from(String(s),'utf8').toString('base64')+"'))";
class TrainingSpeech{
 constructor(){this.child=null;}
 run(script){if(this.child)throw Error('A local pilot readback is already playing.');return new Promise((resolve,reject)=>{
  const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',encode("$ErrorActionPreference='Stop'; try { Add-Type -AssemblyName System.Speech; "+script+" } catch { exit 1 }")],{windowsHide:true,stdio:['ignore','pipe','ignore']});this.child=child;let output='',canceled=false;
  const timer=setTimeout(()=>{canceled=true;child.kill();},60000);child.stdout.on('data',data=>{output+=data.toString();if(output.length>100000){canceled=true;child.kill();}});
  child.on('error',()=>{clearTimeout(timer);if(this.child===child)this.child=null;reject(Error('Windows local speech could not start. No maneuver executed.'));});
  child.on('close',code=>{clearTimeout(timer);if(this.child===child)this.child=null;if(code!==0||canceled||child.killed)reject(Error('Pilot readback failed or was canceled. No maneuver executed.'));else resolve(output);});
 });}
 async voices(){const raw=await this.run("[Console]::OutputEncoding=[Text.Encoding]::UTF8; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; $v=@($s.GetInstalledVoices() | Where-Object {$_.Enabled -and $_.VoiceInfo.Culture.Name -like 'en*'} | ForEach-Object {$_.VoiceInfo.Name}); ConvertTo-Json -InputObject $v -Compress; $s.Dispose()");try{return JSON.parse(raw.trim());}catch{throw Error('No readable local Windows voice list.');}}
 speak(text,voice){return this.run('$s=New-Object System.Speech.Synthesis.SpeechSynthesizer; $text='+literal(text)+'; $voice='+literal(voice||'')+'; if($voice){$s.SelectVoice($voice)}; $s.SetOutputToDefaultAudioDevice(); $s.Speak($text); $s.Dispose()');}
 cancel(){this.child?.kill();}
}
async function playReadback(pilot,speech,value){
 pilot.expire();const p=pilot.pending.get(value?.id);if(!p||p.sessionId!==value?.sessionId)throw Error('Readback is stale.');
 try{const {a}=pilot.validate(p);if((a.revision||0)!==p.revision)throw Error('Aircraft instructions changed before readback. Repeat the clearance.');await speech.speak(p.readback,String(value.voice||''));return pilot.complete(value);}catch(error){pilot.cancel(value.id);throw error;}
}
async function playCheckIn(pilot,speech,value){
 if(!pilot.enabled||pilot.readbackMode!=='windows'||!pilot.training.running||value?.sessionId!==pilot.training.sessionId)throw Error('Check-in requires the current running local Windows-voice session.');
 if(pilot.checkInSession!==value.sessionId){pilot.checkInSession=value.sessionId;pilot.checkedIn=new Set();}
 const a=pilot.training.aircraft.find(a=>a.callsign===value.callsign&&a.active&&!a.paused);
 if(!a)throw Error('No active aircraft for check-in.');
 if(pilot.checkedIn.has(a.callsign))return {status:'already_checked_in'};
 const {checkIn}=require('./training-pilot');await speech.speak(checkIn(a),String(value.voice||''));
 if(pilot.training.sessionId===value.sessionId)pilot.checkedIn.add(a.callsign);
 return {status:'checked_in'};
}
module.exports={TrainingSpeech,playReadback,playCheckIn};
