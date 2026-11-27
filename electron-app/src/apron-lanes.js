// Simulator planning pockets from the supplied apron diagram, not gate lead-in routes.
const slots={north:['1','2','3','4','5','6','Apron edge'],south:['7','8','9','10','11','12','Apron edge'],other:['FedEx apron','Infield terminal','Other apron']};
const pockets=[
 ['1/2','A1A A1B A1C A1D A2 A3 A4 A5 A6 B7 B8 B9 B10 B11 B12 B13 B14 B15 B16 B17'],
 ['3/4','B18 B19 B20 B22 C24 C25 C26 C27 C28 C29 C30 C31 C32'],
 ['5/6','C33 C34 C34A C35 C36 C37 C38 C39 C40 C41 103 105 107 109 111 112 110 108 128 126 124 122 120 131 133 135 137 139 140 141 142'],
 ['7/8','143 144 145 138 136 134 132 151 153 155 157 161 163 165 167 169 170 171 172 173'],
 ['9/10','160 162 164 166 168A 168B 181 180 179 178 191 193 246 248 250 252 254 256'],
 ['11/12','245C 245A 247 249 251 253 H1 H2 H3 H4 H5 H6 H7 H8 H9 H10 H11 H12 H13 H14 H15 H16 H17 H18'],
 ['Apron edge','174 175 176 177']
];
const gates=new Map(pockets.flatMap(([p,list])=>list.split(' ').map(g=>[g,p])));
function pocket(g){return gates.get(String(g||'').trim().toUpperCase())||'';}
function group(l){return pockets.find(([p])=>p.split('/').includes(l))?.[0];}
function conflict(a,b){
 if(a.id===b.id||a.state==='done'||b.state==='done')return '';
 if(a.stand&&a.stand===b.stand)return 'Same stand '+a.stand;
 if([a,b].some(r=>r.state==='parked'))return '';
 const resource=r=>r.lane?(group(r.lane)||r.lane):pocket(r.stand);const pa=resource(a),pb=resource(b);
 if(!pa||pa!==pb||pa==='outer')return '';
 if(a.type==='block'||b.type==='block')return 'Obstruction in '+pa;
 if(a.flow&&b.flow)return a.flow!==b.flow?'Opposing flow in '+pa:'';
 return a.type!==b.type?'Check inbound / outbound paths in '+pa:'';
}
module.exports={slots,pocket,conflict};
