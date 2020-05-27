#version 430
/*************************************************************************************************/
/*                        Vertex Shader for Implicity Surface Ray Tracing                        */	
/*************************************************************************************************/
in vec3 vPosition; //Входные переменные vPosition - позиция вершины
// out vec3 origin, direction;
out vec3 glPosition; 


void main ( void )
{
   // gl_TexCoord [0] = gl_Vertex;
   //gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;
   gl_Position = vec4(vPosition, 1.0);
   glPosition = vPosition;
}

