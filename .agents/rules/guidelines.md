# Development Guidelines

## Code Quality Standards

### TypeScript/React Frontend Standards

**File Organization**
- Use 'use client' directive for client-side React components
- Group imports logically: React/Next.js, UI components, hooks, utilities
- Define interfaces at the top of files before component definitions
- Export default for page components, named exports for utilities

**Naming Conventions**
- PascalCase for components, interfaces, and types (Campaign, ChatMessage, ChartData)
- camelCase for variables, functions, and hooks (handleSubmit, currentChat, isLoading)
- Prefix boolean variables with is/has/should (isLoading, hasError, shouldShow)
- Prefix event handlers with handle (handleClick, handleSubmit, handleDelete)
- Prefix state setters with set (setInputMessage, setCurrentChatId)

**Component Structure**
- Define interfaces before component
- Declare component with typed props
- Group state declarations together
- Place useEffect hooks after state declarations
- Define event handlers after hooks
- Return JSX at the end
- Use fragments (<></>) or semantic HTML over unnecessary divs

**State Management Patterns**
- Use useState for local component state
- Use custom hooks for complex state logic (useChatPage, useAuth, useWorkspaceSelection)
- Implement optimistic UI updates before API calls
- Handle loading and error states explicitly
- Use useCallback for event handlers passed to child components
- Use useEffect with proper dependency arrays

### Go Backend Standards

**File Organization**
- Package declaration first
- Imports grouped: standard library, external packages, internal packages
- Constants defined after imports
- Type definitions before functions
- Constructor functions (New*) before methods
- Public methods before private methods

**Naming Conventions**
- PascalCase for exported types and functions (ChatHandler, SendMessage)
- camelCase for unexported functions and variables (getUserEmail, parseAnalysisResponse)
- ALL_CAPS for constants (maxPromptDimensions, ragRequestTimeout)
- Descriptive method names with context (AnalyzeUserQuery, GenerateFollowUpQuestions)
- Prefix interface names with Interface suffix (OpenAIServiceInterface, LoggerInterface)

**Error Handling**
- Always check and handle errors explicitly
- Return errors with context using fmt.Errorf with %w for wrapping
- Log errors before returning them
- Use const method = "FunctionName" for consistent logging
- Provide user-friendly error messages in API responses
- Distinguish between client errors (4xx) and server errors (5xx)

**Struct Patterns**
- Define request/response structs with json tags
- Use pointer receivers for methods that modify state
- Use value receivers for methods that only read
- Embed interfaces for dependency injection
- Use struct tags for JSON marshaling (json:"field_name")

## Semantic Patterns

### Frontend Patterns

**Custom Hooks Pattern**
```typescript
// Encapsulate complex state logic in custom hooks
export const useChatPage = (initialChatId?: string) => {
  // State declarations
  const [state, setState] = useState(initialValue);
  
  // Effects
  useEffect(() => {
    // Side effects
  }, [dependencies]);
  
  // Event handlers
  const handleAction = async () => {
    // Implementation
  };
  
  // Return public API
  return {
    state,
    handleAction,
  };
};
```

**Async State Management Pattern**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!inputMessage.trim() || loading) return;
  
  setLastError(null);
  setIsTransitioning(true);
  
  try {
    const result = await sendMessage(message);
    // Handle success
    setCurrentChatId(result.chatId);
    router.push(`/chat/${result.chatId}`);
  } catch (error) {
    // Handle error
    setLastError(errorMessage);
  } finally {
    setIsTransitioning(false);
  }
};
```

**Conditional Rendering Pattern**
```typescript
{currentStep === 1 && (
  <div className="space-y-8">
    {/* Step content */}
  </div>
)}

{loading ? (
  <LoadingSpinner />
) : error ? (
  <ErrorMessage message={error} />
) : (
  <Content data={data} />
)}
```

### Backend Patterns

**Handler Pattern**
```go
type ChatHandler struct {
    db            *mongo.Database
    openAIService services.OpenAIServiceInterface
    cubeJSService services.CubeJSServiceInterface
    logger        utils.LoggerInterface
}

func NewChatHandler(db *mongo.Database, openAI services.OpenAIServiceInterface, cube services.CubeJSServiceInterface, logger utils.LoggerInterface) *ChatHandler {
    return &ChatHandler{
        db:            db,
        openAIService: openAI,
        cubeJSService: cube,
        logger:        logger,
    }
}

func (h *ChatHandler) SendMessage(c *gin.Context) {
    const method = "SendMessage"
    h.logger.Debug(method, "Received chat message request")
    
    var req models.ChatRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        utils.SendJSONResponse(c, http.StatusBadRequest, "Invalid request", err.Error())
        return
    }
    
    // Business logic
    
    utils.SendJSONResponse(c, http.StatusOK, "Success", response)
}
```

**Service Layer Pattern**
```go
type OpenAIService struct {
    apiKey     string
    endpoint   string
    client     *http.Client
    logger     utils.LoggerInterface
}

func (s *OpenAIService) AnalyzeUserQuery(request models.ChatAnalysisRequest, authToken string) (*models.ChatAnalysisResponse, error) {
    const method = "AnalyzeUserQuery"
    
    // Prepare request
    prompt := s.renderAnalysisPrompt(request)
    
    // Call external service
    gatewayResp, err := s.callGatewayDescription(prompt, ...)
    if err != nil {
        s.logger.Error(method, "Gateway AI call failed: "+err.Error())
        return nil, fmt.Errorf("failed to call AI gateway: %w", err)
    }
    
    // Parse response
    analysis, tokensUsed, err := s.parseAnalysisResponse(gatewayResp)
    if err != nil {
        s.logger.Error(method, "Failed to parse AI response: "+err.Error())
        return nil, fmt.Errorf("failed to decode AI output: %w", err)
    }
    
    return analysis, nil
}
```

**Error Handling Pattern**
```go
// Always log before returning errors
if err != nil {
    h.logger.Error(method, "Operation failed: "+err.Error())
    utils.SendErrorResponse(c, http.StatusInternalServerError, "User-friendly message")
    return
}

// Wrap errors with context
if err := someOperation(); err != nil {
    return fmt.Errorf("failed to perform operation: %w", err)
}

// Provide fallback values
analysis, err := h.openAIService.AnalyzeUserQuery(req, token)
if err != nil {
    h.logger.Error(method, "OpenAI analysis failed: "+err.Error())
    // Provide fallback or return error
    return
}
```

**Logging Pattern**
```go
const method = "FunctionName"

// Debug for detailed information
h.logger.Debug(method, fmt.Sprintf("Processing request; dims=%d meas=%d", len(dims), len(meas)))

// Info for important events
h.logger.Info(method, "Chat created successfully")

// Warn for recoverable issues
h.logger.Warn(method, "Catalog matching failed: "+err.Error())

// Error for failures
h.logger.Error(method, "Failed to save messages: "+err.Error())
```

## Internal API Usage Patterns

### Frontend API Calls

**Using API Client**
```typescript
import { apiPost, apiGet } from '@/lib/api';

// POST request
const data = await apiPost<ResponseType>('/api/endpoint', {
  field: value,
});

// GET request
const data = await apiGet<ResponseType>('/api/endpoint');

// With error handling
try {
  const result = await apiPost('/api/chat/send', {
    message: inputMessage,
    chatId: currentChatId,
  });
  // Handle success
} catch (error) {
  console.error('API call failed:', error);
  setError('User-friendly error message');
}
```

**Router Navigation**
```typescript
import { useRouter } from 'next/navigation';

const router = useRouter();

// Navigate to new route
router.push('/chat');

// Navigate with parameters
router.push(`/chat/${chatId}`);

// Navigate without scroll
router.push(`/chat/${chatId}`, { scroll: false });

// Go back
router.back();
```

### Backend API Patterns

**Gin Route Handlers**
```go
// Bind JSON request
var req models.ChatRequest
if err := c.ShouldBindJSON(&req); err != nil {
    utils.SendJSONResponse(c, http.StatusBadRequest, "Invalid request", err.Error())
    return
}

// Get context values
userEmail := c.GetString("user_email")
authToken, exists := c.Get("auth_token")

// Get URL parameters
chatID := c.Param("chatId")

// Get headers
clientID := c.GetHeader("client-id")

// Send responses
utils.SendJSONResponse(c, http.StatusOK, "Success message", responseData)
utils.SendErrorResponse(c, http.StatusBadRequest, "Error message")
```

**MongoDB Operations**
```go
collection := h.db.Collection("chats")

// Find one
var chat models.Chat
filter := bson.M{"_id": objectID, "user_id": userEmail}
err := collection.FindOne(context.Background(), filter).Decode(&chat)

// Find many with options
findOpts := options.Find().SetSort(bson.D{{Key: "updated_at", Value: -1}})
cursor, err := collection.Find(context.Background(), filter, findOpts)

// Insert
_, err := collection.InsertOne(context.Background(), document)

// Update
update := bson.M{
    "$push": bson.M{"messages": bson.M{"$each": messages}},
    "$set":  bson.M{"updated_at": time.Now()},
}
_, err := collection.UpdateOne(context.Background(), filter, update)

// Delete
result, err := collection.DeleteOne(context.Background(), filter)
```

**HTTP Client Calls**
```go
client := &http.Client{Timeout: 30 * time.Second}

// Create request
req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
if err != nil {
    return err
}

// Set headers
req.Header.Set("Content-Type", "application/json")
req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
req.Header.Set("client-id", clientID)

// Execute request
resp, err := client.Do(req)
if err != nil {
    return err
}
defer resp.Body.Close()

// Read response
body, err := io.ReadAll(resp.Body)
if err != nil {
    return err
}

// Check status
if resp.StatusCode != http.StatusOK {
    return fmt.Errorf("API error: status %d", resp.StatusCode)
}

// Parse JSON
var result ResponseType
if err := json.Unmarshal(body, &result); err != nil {
    return err
}
```

## Code Idioms

### TypeScript Idioms

**Optional Chaining and Nullish Coalescing**
```typescript
const userName = user?.firstName ?? 'Guest';
const chatTitle = currentChat?.title ?? 'New Chat';
```

**Array Operations**
```typescript
// Filter
const activeCampaigns = campaigns.filter(c => c.status === 'active');

// Map
const campaignNames = campaigns.map(c => c.name);

// Find
const campaign = campaigns.find(c => c.id === selectedId);

// Some/Every
const hasErrors = messages.some(m => m.error);
const allValid = fields.every(f => f.isValid);

// Reduce
const total = items.reduce((sum, item) => sum + item.value, 0);
```

**Destructuring**
```typescript
// Object destructuring
const { user, loading, error } = useAuth();

// Array destructuring
const [state, setState] = useState(initialValue);

// Nested destructuring
const { data: { results } } = response;

// Rest operator
const { id, ...rest } = object;
```

**Template Literals**
```typescript
const message = `Hello ${user.name}, you have ${count} messages`;
const url = `/api/chat/${chatId}/messages`;
```

### Go Idioms

**Error Handling**
```go
// Check and return
if err != nil {
    return nil, err
}

// Check and log
if err != nil {
    logger.Error(method, "Operation failed: "+err.Error())
    return nil, err
}

// Early return pattern
if condition {
    return earlyValue, nil
}
// Continue with main logic
```

**Nil Checks**
```go
if analysis == nil {
    return nil, errors.New("analysis is nil")
}

if strings.TrimSpace(value) == "" {
    return defaultValue
}
```

**Slice Operations**
```go
// Append
items = append(items, newItem)

// Append multiple
items = append(items, item1, item2, item3)

// Append slice
items = append(items, otherSlice...)

// Filter (manual)
var filtered []Item
for _, item := range items {
    if item.IsValid {
        filtered = append(filtered, item)
    }
}

// Map (manual)
names := make([]string, 0, len(items))
for _, item := range items {
    names = append(names, item.Name)
}
```

**String Operations**
```go
// Trim
trimmed := strings.TrimSpace(value)

// Join
result := strings.Join(items, ", ")

// Split
parts := strings.Split(value, ".")

// Contains
if strings.Contains(haystack, needle) {
    // ...
}

// Replace
cleaned := strings.ReplaceAll(text, "old", "new")

// Case conversion
lower := strings.ToLower(text)
upper := strings.ToUpper(text)
```

**Map Operations**
```go
// Initialize
seen := make(map[string]struct{})
counts := make(map[string]int)

// Check existence
if _, exists := seen[key]; exists {
    // Key exists
}

// Set value
seen[key] = struct{}{}
counts[key]++

// Delete
delete(seen, key)

// Iterate
for key, value := range myMap {
    // Process key and value
}
```

## Annotations and Documentation

### TypeScript Documentation

**JSDoc Comments**
```typescript
/**
 * Custom hook for managing chat page state and interactions
 * @param initialChatId - Optional chat ID to load on mount
 * @returns Object containing state and handlers for chat functionality
 */
export const useChatPage = (initialChatId?: string) => {
  // Implementation
};

/**
 * Handles form submission for sending chat messages
 * Manages loading states, error handling, and navigation
 */
const handleSubmit = async (e: React.FormEvent) => {
  // Implementation
};
```

**Inline Comments**
```typescript
// Load chat history when chatId from URL changes
useEffect(() => {
  if (initialChatId) {
    setCurrentChatId(initialChatId);
    loadChatHistory(initialChatId);
  }
}, [initialChatId]);

// Prefer structured CubeJS data; if absent, send textual response
var apiResponse interface{}
if cubeJSData != nil {
    apiResponse = cubeJSData
} else {
    apiResponse = respText
}
```

### Go Documentation

**Package Documentation**
```go
// Package handlers provides HTTP request handlers for the chat API.
// It includes handlers for sending messages, managing chat history,
// and user authentication.
package handlers
```

**Function Documentation**
```go
// AnalyzeUserQuery processes a user's natural language query and determines
// if it can be fulfilled with available dimensions and measures.
// It returns a structured query for CubeJS or an explanation if the query
// cannot be fulfilled.
func (s *OpenAIService) AnalyzeUserQuery(request models.ChatAnalysisRequest, authToken string) (*models.ChatAnalysisResponse, error) {
    // Implementation
}
```

**Inline Comments**
```go
// Guard against empty/invalid queries before hitting CubeJS
hasParts := (len(analysis.Query.Measures) > 0) || (len(analysis.Query.Dimensions) > 0)

// Process CubeJS data into chart format using AI
var chartData *models.ChartData
if cubeJSData != nil {
    processedChart, err := h.processDataForChart(cubeJSData, clientID, workspaceID, userID, authToken)
    // ...
}

// Generate and update chat title asynchronously
go h.generateAndUpdateChatTitle(chat.ID, req.Message, clientID, workspaceID, userID, authToken)
```

## Testing Practices

**Frontend Testing Approach**
- Test user interactions and state changes
- Mock API calls and external dependencies
- Test error handling and edge cases
- Verify navigation and routing behavior

**Backend Testing Approach**
- Unit test service layer functions
- Test error handling paths
- Mock external API calls
- Test database operations with test database
- Validate request/response serialization

## Performance Considerations

**Frontend Optimization**
- Use useCallback for event handlers passed to children
- Implement debouncing for search inputs
- Lazy load heavy components
- Optimize re-renders with React.memo when needed
- Use pagination for large lists

**Backend Optimization**
- Use context with timeout for external API calls
- Implement caching for frequently accessed data
- Use database indexes for common queries
- Batch database operations when possible
- Stream large responses instead of loading into memory
- Use goroutines for independent async operations
