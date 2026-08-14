package engine

import (
	"testing"

	"github.com/google/uuid"
)

func TestLoopGuard(t *testing.T) {
	guard := NewLoopGuard(3) // Max 3 iterations
	nodeID := uuid.New()

	for i := 0; i < 3; i++ {
		canExec, count := guard.RecordAndCheck(nodeID)
		if !canExec {
			t.Errorf("Iteration %d should be allowed", i+1)
		}
		if count != i+1 {
			t.Errorf("Expected count %d, got %d", i+1, count)
		}
	}

	// 4th iteration should be blocked
	canExec, count := guard.RecordAndCheck(nodeID)
	if canExec {
		t.Errorf("4th iteration exceeded max loops (3) and should have been blocked")
	}
	if count != 4 {
		t.Errorf("Expected count 4, got %d", count)
	}

	// Reset should restore capability
	guard.Reset()
	canExecAfterReset, countReset := guard.RecordAndCheck(nodeID)
	if !canExecAfterReset || countReset != 1 {
		t.Errorf("Expected guard reset to restore execution counter")
	}
}
