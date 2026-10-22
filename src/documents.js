// Fictional paper props. Only the loose memorandum carries a puzzle sequence.
export const deskPapers = [
  {title:'Household account',lines:['Household account','Flour                 2 sacks','Lamp oil             1 bottle','Candles             3 bundles','Cotton thread      2 spools','Balance carried forward'],description:'An account of ordinary household supplies. Nothing here matches the marks in the paintings.'},
  {title:'Unfinished letter',lines:['My dear friend,','The rain has at last passed.','I have mended the torn cloth','and put the small things away.','I shall write again when the','weather is fair.'],description:'An unfinished letter about the weather and household work. The end is missing.'},
  {title:'List of supplies',lines:['To be put away','length of rope','two empty jars','a small iron hinge','seed for the garden','cloth for the window'],description:'A list of supplies, written in faded ink and crossed out in several places.'},
  {title:'Loose memorandum',lines:['Memorandum','a few things to remember','before the day is done'],description:'Four unusual marks appear among the faded handwriting.'},
  {title:'Receipt',lines:['Received in good order','one bundle of linen','one parcel of thread','one earthenware cup','','Paid and entered'],description:'A worn receipt with a faded signature. It contains no sequence of symbols.'},
  {title:'Ink-stained draft',lines:['Draft','','the light in the window','the sound along the road','the weather yet unsettled',''],description:'Most of the writing has been crossed out or covered with spilled ink.'},
  {title:'Field sketch',lines:['The lower field'],description:'A rough field sketch with a path, trees, and pencil measurements.'},
];

export function drawPaper(c,w,h,index){
 const data=deskPapers[index];
 const rand=n=>{const x=Math.sin(n*127.1+index*311.7)*43758.5453;return x-Math.floor(x);};
 c.clearRect(0,0,w,h);c.save();c.scale(w/512,h/700);
 const gradient=c.createLinearGradient(0,0,512,700);gradient.addColorStop(0,['#d8c6a1','#dfd0ae','#cbb58d','#e0cfaa','#d3c29a','#cbb48e','#ddcba5'][index]);gradient.addColorStop(.5,'#e4d2ab');gradient.addColorStop(1,'#c5ab7c');
 c.beginPath();c.moveTo(11,8);for(let x=12;x<504;x+=13)c.lineTo(x,7+rand(x)*5);c.lineTo(504,691);for(let x=502;x>8;x-=13)c.lineTo(x,690+rand(x+1)*6);c.lineTo(8,12);c.closePath();c.fillStyle=gradient;c.fill();
 c.strokeStyle='#886d4544';c.lineWidth=2;c.stroke();
 for(let i=0;i<1400;i++){c.fillStyle=i%3?'#63442008':'#fff8dd13';c.fillRect(rand(i+11)*492+10,rand(i+33)*677+10,rand(i+67)*2+1,1);}
 for(let i=0;i<8;i++){const x=rand(i+340)*460+20,y=rand(i+320)*650+20;const g=c.createRadialGradient(x,y,1,x,y,rand(i+325)*65+25);g.addColorStop(0,'#79532d12');g.addColorStop(1,'#79532d00');c.fillStyle=g;c.fillRect(8,8,496,684);}
 c.strokeStyle='#765c3526';c.lineWidth=1;c.beginPath();c.moveTo(20,350);c.lineTo(490,346);c.stroke();c.strokeStyle='#fff0c83d';c.beginPath();c.moveTo(20,353);c.lineTo(490,349);c.stroke();
 c.translate(40,62);c.rotate((index%2?-.016:.013));c.fillStyle='#4f4235c9';c.font='italic 27px Georgia,serif';
 data.lines.forEach((line,n)=>{c.fillStyle=n===0?'#4a382bd9':'#5c4939b5';c.font=n===0?'italic 31px Georgia,serif':'italic 25px Georgia,serif';c.fillText(line,0,n*57,430);});
 if(index===3){c.fillStyle='#504434c9';c.font='38px Georgia,serif';c.fillText('△   ○   ☆   □',30,270);c.font='italic 23px Georgia,serif';c.fillStyle='#5c49397a';c.fillText('when all is gathered',0,358);c.fillText('keep this close',0,408);}
 if(index===5){c.strokeStyle='#46372cbb';c.lineWidth=2;for(let i=0;i<9;i++){c.beginPath();c.moveTo(12,100+i*17);c.lineTo(340-i*13,115+i*16);c.stroke();}c.fillStyle='#342b2580';c.beginPath();c.ellipse(310,398,50,35,-.3,0,Math.PI*2);c.fill();}
 if(index===6){c.strokeStyle='#695740b0';c.lineWidth=2;c.beginPath();c.moveTo(25,130);c.lineTo(340,100);c.lineTo(380,355);c.lineTo(90,385);c.closePath();c.moveTo(140,115);c.lineTo(180,372);c.moveTo(25,262);c.lineTo(365,215);c.stroke();c.font='italic 21px Georgia,serif';c.fillText('north pasture',100,200);c.fillText('old path',205,340);}
 c.font='italic 21px Georgia,serif';c.fillStyle='#634e3770';c.fillText(index===3?'': '— entered in the book',95,535);
 c.restore();
}

export function paperImage(index){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=700;
 drawPaper(canvas.getContext('2d'),512,700,index);
 return canvas.toDataURL('image/png');
}
