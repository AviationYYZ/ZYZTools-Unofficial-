#include "../src/MemoryWarning.h"
#include <cassert>
int main(){
 MemoryWarning m;
 assert(!m.sample(1500,900,2000));assert(!m.sample(4000,900,2000));
 assert(!m.sample(4000,300,2000));assert(m.sample(4000,300,2000)==1);
 assert(!m.sample(4000,300,2000));assert(m.sample(4000,100,2000)==2);
 assert(!m.sample(4000,100,2000));
 for(int i=0;i<3;++i)assert(!m.sample(4000,900,2000));
 assert(m.sample(4000,900,200)==2);
}
