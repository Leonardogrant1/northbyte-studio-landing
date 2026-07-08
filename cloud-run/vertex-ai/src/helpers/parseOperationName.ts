export function parseOperationName(operationName: string) {
    const match = operationName.match(
      /projects\/([^\/]+)\/locations\/([^\/]+)\/publishers\/([^\/]+)\/models\/([^\/]+)\/operations\/([^\/]+)/
    );
    
    if (!match) {
      throw new Error('Invalid operation name format');
    }
    
    return {
      projectId: match[1],
      location: match[2],
      publisher: match[3],
      modelId: match[4],
      operationId: match[5]
    };
  }
