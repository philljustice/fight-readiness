const P = require('./profile.js'), assert = require('assert'), T = new Date(2026,9,19);
assert.deepEqual(Object.keys(P.validate({}, T)), ['name']);
assert.deepEqual(P.validate({name:'Alex'}, T), {});
const bad = P.validate({name:'A', dob:'2030-01-01', startWeight:'20', targetWeight:'500', fightDate:'2026-10-01', coachContact:'abc@', emPhone:'12', discipline:'Karate'}, T);
assert.deepEqual(Object.keys(bad).sort(), ['coachContact','discipline','dob','emName','emPhone','fightDate','startWeight','targetWeight']);
assert.deepEqual(P.validate({name:'A', dob:'2008-05-01', startWeight:'172.8', targetWeight:'155', fightDate:'2026-10-19', coachContact:'coach@gym.com', emName:'Mom', emPhone:'(613) 555-0100', discipline:'MMA'}, T), {});
assert.deepEqual(P.validate({name:'A', coachContact:'613-555-0100'}, T), {});
assert.equal(P.age('2008-10-20', T), 17); assert.equal(P.age('2008-10-19', T), 18);
assert.equal(P.countdown('2026-11-02', T).days, 14); assert.equal(P.countdown('2026-11-02', T).text, '14 days to fight (2w 0d)');
assert.equal(P.countdown('2026-10-19', T).text, 'Fight day! 🥊'); assert.equal(P.countdown('2026-10-01', T), null);
assert.equal(P.weightStatus(170.4, 155).text, '15.4 lbs to cut'); assert.equal(P.weightStatus(154, 155).text, '1 lbs under target'); assert.equal(P.weightStatus('', 155), null);
const wk = { days: [['Skill','Wrestling','Muay thai'],['Str','S&C',''],['Rest + Active Recovery','Walk','']].map(([f,a,b])=>({focus:f,s1:a,s2:b})) };
const sc = P.scheduleFromWeek(wk); assert.deepEqual(sc.days.map(d=>d.n), [2,1,0,0,0,0,0]); assert.deepEqual(sc.days[0].labels, ['Wrestling','Muay thai']);
const ses = P.sessionsFor(sc, '2026-10-19'); assert.equal(ses.length, 2); assert.equal(ses[1].label, 'Muay thai'); assert.equal(ses[0].done, null); // Monday
assert.deepEqual(P.sessionsFor(sc, '2026-10-21'), []); assert.equal(P.sessionsFor(null, '2026-10-21'), null);
const w2 = { days: Array.from({length:7},()=>({focus:'Skill',s1:'x',s2:'y',s3:'z'})) }; P.applyToWeek(sc, w2);
assert.equal(w2.days[0].s1,'Wrestling'); assert.equal(w2.days[1].s2,''); assert.equal(w2.days[2].focus,'Rest'); assert.equal(w2.days[2].s1,'');
console.log('All profile tests passed');
