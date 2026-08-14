package engine

import (
	"sync"

	"github.com/google/uuid"
)

type LoopGuard struct {
	mu       sync.Mutex
	maxLoops int
	counts   map[uuid.UUID]int
}

func NewLoopGuard(maxLoops int) *LoopGuard {
	if maxLoops <= 0 {
		maxLoops = 5
	}
	return &LoopGuard{
		maxLoops: maxLoops,
		counts:   make(map[uuid.UUID]int),
	}
}

func (lg *LoopGuard) RecordAndCheck(nodeID uuid.UUID) (bool, int) {
	lg.mu.Lock()
	defer lg.mu.Unlock()

	lg.counts[nodeID]++
	curr := lg.counts[nodeID]

	if curr > lg.maxLoops {
		return false, curr
	}
	return true, curr
}

func (lg *LoopGuard) Reset() {
	lg.mu.Lock()
	defer lg.mu.Unlock()
	lg.counts = make(map[uuid.UUID]int)
}
