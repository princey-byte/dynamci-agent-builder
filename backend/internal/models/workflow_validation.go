package models

import "fmt"

func ValidateWorkflowRoles(supervisor *Agent, workers []Agent) error {
	if supervisor == nil {
		return fmt.Errorf("supervisor agent is required")
	}
	if supervisor.RoleType != RoleSupervisor {
		return fmt.Errorf("supervisor agent must have role_type supervisor, got %s", supervisor.RoleType)
	}

	for _, worker := range workers {
		if worker.RoleType != RoleWorker {
			return fmt.Errorf("worker agent must have role_type worker, got %s for %s", worker.RoleType, worker.Name)
		}
		if worker.ID == supervisor.ID {
			return fmt.Errorf("supervisor agent cannot also be a worker")
		}
	}

	return nil
}