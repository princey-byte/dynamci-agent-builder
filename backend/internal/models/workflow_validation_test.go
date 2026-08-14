package models

import (
	"strings"
	"testing"

	"github.com/google/uuid"
)

func TestValidateWorkflowRolesAcceptsSupervisorAndWorkers(t *testing.T) {
	supervisor := &Agent{ID: uuid.New(), Name: "Supervisor", RoleType: RoleSupervisor}
	workers := []Agent{
		{ID: uuid.New(), Name: "Worker A", RoleType: RoleWorker},
		{ID: uuid.New(), Name: "Worker B", RoleType: RoleWorker},
	}

	if err := ValidateWorkflowRoles(supervisor, workers); err != nil {
		t.Fatalf("expected valid roles, got %v", err)
	}
}

func TestValidateWorkflowRolesRejectsWorkerSupervisor(t *testing.T) {
	supervisor := &Agent{ID: uuid.New(), Name: "Worker selected as supervisor", RoleType: RoleWorker}

	err := ValidateWorkflowRoles(supervisor, nil)
	if err == nil {
		t.Fatal("expected worker supervisor to be rejected")
	}
	if !strings.Contains(err.Error(), "supervisor agent must have role_type supervisor") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateWorkflowRolesRejectsSupervisorWorker(t *testing.T) {
	supervisor := &Agent{ID: uuid.New(), Name: "Supervisor", RoleType: RoleSupervisor}
	workers := []Agent{{ID: uuid.New(), Name: "Supervisor selected as worker", RoleType: RoleSupervisor}}

	err := ValidateWorkflowRoles(supervisor, workers)
	if err == nil {
		t.Fatal("expected supervisor worker to be rejected")
	}
	if !strings.Contains(err.Error(), "worker agent must have role_type worker") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateWorkflowRolesRejectsNilSupervisor(t *testing.T) {
	err := ValidateWorkflowRoles(nil, nil)
	if err == nil {
		t.Fatal("expected missing supervisor to be rejected")
	}
	if !strings.Contains(err.Error(), "supervisor agent is required") {
		t.Fatalf("unexpected error: %v", err)
	}
}