package engine

import (
	"fmt"

	"agentic-platform/backend/internal/models"

	"github.com/google/uuid"
)

type DAG struct {
	Nodes        map[uuid.UUID]models.WorkflowNode
	Adjacency    map[uuid.UUID][]models.WorkflowEdge
	InDegree     map[uuid.UUID]int
	ReverseEdges map[uuid.UUID][]models.WorkflowEdge
}

func BuildDAG(nodes []models.WorkflowNode, edges []models.WorkflowEdge) (*DAG, error) {
	dag := &DAG{
		Nodes:        make(map[uuid.UUID]models.WorkflowNode),
		Adjacency:    make(map[uuid.UUID][]models.WorkflowEdge),
		InDegree:     make(map[uuid.UUID]int),
		ReverseEdges: make(map[uuid.UUID][]models.WorkflowEdge),
	}

	for _, node := range nodes {
		dag.Nodes[node.ID] = node
		dag.Adjacency[node.ID] = []models.WorkflowEdge{}
		dag.InDegree[node.ID] = 0
		dag.ReverseEdges[node.ID] = []models.WorkflowEdge{}
	}

	for _, edge := range edges {
		if _, exists := dag.Nodes[edge.SourceNodeID]; !exists {
			// If edge references an ID that is not a node (e.g. root supervisor virtual node), skip or ignore gracefully
			continue
		}
		if _, exists := dag.Nodes[edge.TargetNodeID]; !exists {
			continue
		}
		dag.Adjacency[edge.SourceNodeID] = append(dag.Adjacency[edge.SourceNodeID], edge)
		dag.InDegree[edge.TargetNodeID]++
		dag.ReverseEdges[edge.TargetNodeID] = append(dag.ReverseEdges[edge.TargetNodeID], edge)
	}

	return dag, nil
}

func (d *DAG) TopologicalSort() ([]models.WorkflowNode, error) {
	inDegree := make(map[uuid.UUID]int)
	for k, v := range d.InDegree {
		inDegree[k] = v
	}

	var queue []uuid.UUID
	for id, degree := range inDegree {
		if degree == 0 {
			queue = append(queue, id)
		}
	}

	var result []models.WorkflowNode
	for len(queue) > 0 {
		currID := queue[0]
		queue = queue[1:]
		result = append(result, d.Nodes[currID])

		for _, edge := range d.Adjacency[currID] {
			inDegree[edge.TargetNodeID]--
			if inDegree[edge.TargetNodeID] == 0 {
				queue = append(queue, edge.TargetNodeID)
			}
		}
	}

	if len(result) != len(d.Nodes) {
		return nil, fmt.Errorf("cyclic dependency detected in workflow DAG")
	}

	return result, nil
}

func (d *DAG) GetOutgoingEdges(nodeID uuid.UUID) []models.WorkflowEdge {
	return d.Adjacency[nodeID]
}

func (d *DAG) GetIncomingEdges(nodeID uuid.UUID) []models.WorkflowEdge {
	return d.ReverseEdges[nodeID]
}
