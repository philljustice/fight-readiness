global.Scoring=require('./scoring.js');const I=require('./insights.js');const a=require('assert');
const d=new Date(),y=Scoring.ymd(d);const e={date:y,v:2,energy:2,soreness:5,stress:4,mood:4,sleepq:2,motivation:1,appetite:2};
const f=I.wellness([e],d).flags.map(x=>x.text);console.log(f);
a(f.includes('High muscle soreness (5/5)'));a(f.includes('High stress (4/5)'));a(f.includes('Low energy / tired (2/5)'));a(!f.some(t=>/^Low muscle|^Low stress/.test(t)));
const g=I.wellness([{date:y,v:2,energy:4,soreness:1,stress:1,mood:4}],d).flags;a.strictEqual(g.length,0);console.log('ok flags');
