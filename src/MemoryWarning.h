#pragma once
// MiB. Keep checking all three budgets: low physical RAM alone does not
// explain allocation failures in a 32-bit radar process.
struct MemoryWarning {
    unsigned level=0, lowSamples=0, healthySamples=0;
    unsigned sample(unsigned long long ram,unsigned long long address,unsigned long long commit) {
        const unsigned next=(ram<=512 || address<=128 || commit<=256)?2:
            (ram<=1536 || address<=384 || commit<=768)?1:0;
        lowSamples=next?(lowSamples<2?lowSamples+1:2):0;
        healthySamples=(ram>2048 && address>512 && commit>1024)?
            (healthySamples<3?healthySamples+1:3):0;
        if(healthySamples==3)level=0;
        if(next>level && (next==2 || lowSamples==2)){level=next;return next;}
        return 0;
    }
};
