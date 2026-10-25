(()=>{const $=id=>document.getElementById(id),root=$('training');if(!root)return;
 const student=document.createElement('div');student.className='card';student.dataset.trainingPane='student';const h=document.createElement('h3');h.textContent='Student · join a session';student.append(h);const p=document.createElement('p');p.textContent='Paste the student invite from your instructor, then Join with EuroScope. Keep this app running. Use dummy credentials and leave Connect to VATSIM unchecked.';student.append(p);
 const label=$('trainingInvite').closest('label'),buttons=label.nextElementSibling;buttons.append($('trainingJoinStop'));$('trainingJoinStop').textContent='Disconnect';student.append(label,buttons,$('trainingJoinStatus'));
 const advanced=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Advanced · separate host address and key';advanced.append(summary);
 for(const id of ['trainingJoinUrl','trainingJoinKey'])advanced.append($(id).closest('label'));
 advanced.append($('trainingJoinStart').parentElement);student.append(advanced);root.querySelector('.training-heading').after(student);
 function select(view){for(const pane of root.querySelectorAll('[data-training-pane]'))pane.hidden=pane.dataset.trainingPane!==view;for(const button of root.querySelectorAll('[data-training-view]'))button.setAttribute('aria-pressed',String(button.dataset.trainingView===view));root.dispatchEvent(new CustomEvent('training:view',{detail:view}));}
 for(const button of root.querySelectorAll('[data-training-view]'))button.onclick=()=>select(button.dataset.trainingView);select('student');
})();
