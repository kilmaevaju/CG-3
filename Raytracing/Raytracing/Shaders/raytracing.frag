#version 430

/* Фрагментный шейдер вызывается для каждого 
графического элемента (т.е. пикселя растрового 
изображения, попадающего на экран). 
Выходом фрагментного шейдера является цвет пикселя, 
который идёт в буфер цвета. Также в фрагментном 
шейдере выполняется вся основная часть расчёта освещения. */

//****************************************************//
//                   ОБЪЯВЛЕНИЕ КОНСТАНТ              //
//****************************************************//

#define EPSILON = 0.001
#define BIG = 1000000.0 // верхнее ограничение для расстояния
const vec3 Unit = vec3 ( 1.0, 1.0, 1.0 );

/*Если луч пересекается с диффузным объектом, то вычисляется цвет объекта,
а если с зеркальным, то создается новый зеркальный луч, который снова
трассируется в сцену*/

const int DIFFUSE = 1; //диффузия
const int REFLECTION = 2; //отражение
const int REFRACTION = 3; //преломление
const int DIFFUSE_REFLECTION = 1; //диффузное отражение
const int MIRROR_REFLECTION = 2; //зеркальное отражение

/*Параметры стека лучей*/

const int MAX_STACK_SIZE = 10; //максимальный размер стека
const int MAX_TRACE_DEPTH = 8; //максимальная глубина трассировки
int stackSize = 0; //размер текущий


//****************************************************//
//           ВХОДНЫЕ И ВЫХОДНЫЕ ПЕРЕМЕННЫЕ            //
//****************************************************//

out vec4 FragColor; // итоговый цвет пикселя
in vec3 glPosition; // позиция вершины

//****************************************************//
//                   СТРУКТУРЫ ДАННЫХ                 //
//****************************************************//

struct SCamera //камера
{
	// отношение сторон выходного изображения
	vec3 Position, View, Up, Side;
	// масштаб
	vec2 Scale;
}; 
 
struct SRay //луч
{
 	vec3 Origin; // начало луча
	vec3 Direction; // направление луча
}; 
 
struct SSphere //сфера
{    
	vec3 Center; // центр
	float Radius; // радиус
	int MaterialIdx; // материал
}; 

struct STriangle //треугольник
{     
    vec3 v1, v2, v3; //вершины
	int MaterialIdx; //материал
};

struct SCube //куб
{
	STriangle bounds[12]; //12 треугольков - куб
	int MaterialIdx; // материал
};

struct SMaterial //материал
{  
    vec3 Color; //цвет
	vec4 LightCoeffs;  //коэффцициенты света
	float ReflectionCoef;  //коэффициенты отражения
	float RefractionCoef;   //коэффициенты преломления
	int MaterialType; //тип
};

struct SIntersection //пересечения
{     
	float Time; // время (на самом деле расстояния)
	vec3 Point; // точка пересечения
	vec3 Normal; // нормаль
	vec3 Color; // цвет

	vec4 LightCoeffs;

	float ReflectionCoef; 
	float RefractionCoef;
	int MaterialType;
};

struct SLight //свет
{ 
    vec3 Position; //позиция
};

struct STracingRay //трассировка
{ 
    SRay ray;  //луч
	float contribution; //вклад в результат
	int depth; //номер переотражения
};

//****************************************************//
//           ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ                    //
//****************************************************//

STriangle Triangles[12]; //массив треугольников
SSphere Spheres[3]; //массив сфер
SMaterial Materials[8]; //материалы
SCube cube; 
SLight uLight; //источник освещения
SCamera uCamera; //камера

//юниформные переменные для изменения цвета куба

uniform float R;
uniform float G;
uniform float B;

//юниформная переменная для изменения глубины рейтресинга

uniform int deep;

vec3 ColorCube = vec3(R,G,B);

//****************************************************//
//                  ФУНКЦИИ                           //
//****************************************************//

SRay GenerateRay ( SCamera uCamera ) //генерация луча
{  
    vec2 coords = glPosition.xy * uCamera.Scale;
	vec3 direction = uCamera.View + uCamera.Side * coords.x + uCamera.Up * coords.y;
	return SRay ( uCamera.Position, normalize(direction) );
}

void initializeDefaultScene (out STriangle triangles[12], out SSphere spheres[3], out SCube cube) // сцена по умолчанию
{
    triangles[0].v1 = vec3(-5.0,-5.0,-8.0); 
	triangles[0].v2 = vec3(-5.0, 5.0, 5.0); 
	triangles[0].v3 = vec3(-5.0, 5.0,-8.0); 
	triangles[0].MaterialIdx = 0; 
 
    triangles[1].v1 = vec3(-5.0,-5.0,-8.0);
	triangles[1].v2 = vec3(-5.0,-5.0, 5.0);
	triangles[1].v3 = vec3(-5.0, 5.0, 5.0); 
	triangles[1].MaterialIdx = 0;
	
	triangles[2].v1 = vec3(-5.0, 5.0, 5.0); 
	triangles[2].v2 = vec3(-5.0, -5.0, 5.0); 
	triangles[2].v3 = vec3(5.0, -5.0, 5.0); 
	triangles[2].MaterialIdx = 1; 
 
    triangles[3].v1 = vec3(5.0,-5.0, 5.0);
	triangles[3].v2 = vec3(5.0, 5.0, 5.0);
	triangles[3].v3 = vec3(-5.0, 5.0, 5.0); 
	triangles[3].MaterialIdx = 1;
	
	triangles[4].v1 = vec3(5.0, -5.0, 5.0); 
	triangles[4].v2 = vec3(5.0, 5.0, 5.0); 
	triangles[4].v3 = vec3(5.0, 5.0, -8.0); 
	triangles[4].MaterialIdx = 2; 
 
    triangles[5].v1 = vec3(5.0, 5.0,-8.0);
	triangles[5].v2 = vec3(5.0, -5.0, -8.0);
	triangles[5].v3 = vec3(5.0, -5.0, 5.0); 
	triangles[5].MaterialIdx = 2;
	
	triangles[6].v1 = vec3(-5.0, 5.0, 5.0); 
	triangles[6].v2 = vec3(-5.0, 5.0, -8.0); 
	triangles[6].v3 = vec3(5.0, 5.0, -8.0); 
	triangles[6].MaterialIdx = 3; 
 
    triangles[7].v1 = vec3(5.0, 5.0, -8.0); 
	triangles[7].v2 = vec3(5.0, 5.0, 5.0); 
	triangles[7].v3 = vec3(-5.0, 5.0, 5.0); 
	triangles[7].MaterialIdx = 3;
 
    triangles[8].v1 = vec3(-5.0, -5.0, 5.0);
	triangles[8].v2 = vec3(-5.0, -5.0, -8.0);
	triangles[8].v3 = vec3(5.0, -5.0, -8.0); 
	triangles[8].MaterialIdx = 4;
	
	triangles[9].v1 = vec3(5.0,-5.0,-8.0);
	triangles[9].v2 = vec3(5.0, -5.0, 5.0);
	triangles[9].v3 = vec3(-5.0, -5.0, 5.0); 
	triangles[9].MaterialIdx = 4;
	
	triangles[10].v1 = vec3(-5.0, -5.0, -8.0);
	triangles[10].v2 = vec3(5.0, -5.0, -8.0);
	triangles[10].v3 = vec3(5.0, 5.0, -8.0); 
	triangles[10].MaterialIdx = 5;
	
	triangles[11].v1 = vec3(5.0, 5.0,-8.0);
	triangles[11].v2 = vec3(-5.0, 5.0, -8.0);
	triangles[11].v3 = vec3(-5.0, -5.0, -8.0); 
	triangles[11].MaterialIdx = 5;
	
	spheres[0].Center = vec3(0.0,1.0,1.0);  
	spheres[0].Radius = 0.2;  
	spheres[0].MaterialIdx = 6; 
 
    spheres[1].Center = vec3(-2.0,1.0,1.0);  
	spheres[1].Radius = 1;  
	spheres[1].MaterialIdx = 6;
	
	spheres[2].Center = vec3(-1,-2.0,-0.7);  
	spheres[2].Radius = 0.3;  
	spheres[2].MaterialIdx = 6;
	
	//задаем куб
	
	cube.bounds[0].v1 = vec3(1.0,1.0,1.0);
	cube.bounds[0].v2 = vec3(1.5,1.0,1.0);
	cube.bounds[0].v3 = vec3(1.0,1.5,1.0);
	
	cube.bounds[1].v1 = vec3(1.5,1.5,1.0);
	cube.bounds[1].v2 = vec3(1.5,1.0,1.0);
	cube.bounds[1].v3 = vec3(1.0,1.5,1.0);
	
	cube.bounds[2].v1 = vec3(1.0,1.0,1.5);
	cube.bounds[2].v2 = vec3(1.5,1.0,1.5);
	cube.bounds[2].v3 = vec3(1.0,1.5,1.5);
	
	cube.bounds[3].v1 = vec3(1.5,1.5,1.5);
	cube.bounds[3].v2 = vec3(1.5,1.0,1.5);
	cube.bounds[3].v3 = vec3(1.0,1.5,1.5);
	
	cube.bounds[4].v1 = vec3(1.0,1.5,1.0);
	cube.bounds[4].v2 = vec3(1.5,1.5,1.5);
	cube.bounds[4].v3 = vec3(1.5,1.5,1.0);
	
	cube.bounds[5].v1 = vec3(1.5,1.5,1.5);
	cube.bounds[5].v2 = vec3(1.5,1.5,1.0);
	cube.bounds[5].v3 = vec3(1.0,1.5,1.5);
	
	cube.bounds[6].v1 = vec3(1.0,1.0,1.0);
	cube.bounds[6].v2 = vec3(1.5,1.0,1.5);
	cube.bounds[6].v3 = vec3(1.5,1.0,1.0);
	
	cube.bounds[7].v1 = vec3(1.5,1.0,1.5);
	cube.bounds[7].v2 = vec3(1.5,1.0,1.0);
	cube.bounds[7].v3 = vec3(1.0,1.0,1.5);
	
	cube.bounds[8].v1 = vec3(1.0,1.0,1.0);
	cube.bounds[8].v2 = vec3(1.0,1.5,1.0);
	cube.bounds[8].v3 = vec3(1.0,1.0,1.5);
	
	cube.bounds[9].v1 = vec3(1.0,1.5,1.5);
	cube.bounds[9].v2 = vec3(1.0,1.5,1.0);
	cube.bounds[9].v3 = vec3(1.0,1.0,1.5);
	
	cube.bounds[10].v1 = vec3(1.5,1.0,1.0);
	cube.bounds[10].v2 = vec3(1.5,1.5,1.0);
	cube.bounds[10].v3 = vec3(1.5,1.0,1.5);
	
	cube.bounds[11].v1 = vec3(1.5,1.5,1.5);
	cube.bounds[11].v2 = vec3(1.5,1.5,1.0);
	cube.bounds[11].v3 = vec3(1.5,1.0,1.5);
	
	
}

void initializeDefaultLightMaterials(out SLight light, out SMaterial materials[8]) //материалы по умолчанию
{
    light.Position = vec3(0.0, 2.0, -4.0f); 
	
    //левая стена
	
    vec4 lightCoefs = vec4(0.4,0.9,0.0,512.0);    
	materials[0].Color = vec3(1.0, 1.0, 0.0);   
	materials[0].LightCoeffs = vec4(lightCoefs);
	materials[0].ReflectionCoef = 0.5;   
	materials[0].RefractionCoef = 1.0;  
	materials[0].MaterialType = DIFFUSE_REFLECTION;  
 
	//дальняя стена
	
    materials[1].Color = vec3(1.0, 1.0, 1.0);  
	materials[1].LightCoeffs = vec4(lightCoefs); 
    materials[1].ReflectionCoef = 0.5;  
	materials[1].RefractionCoef = 1.0;  
	materials[1].MaterialType = MIRROR_REFLECTION;
	
	//правая стена
	
	materials[2].Color = vec3(0.0, 0.0, 1.0);  
	materials[2].LightCoeffs = vec4(lightCoefs); 
    materials[2].ReflectionCoef = 0.5;  
	materials[2].RefractionCoef = 1.0;  
	materials[2].MaterialType = DIFFUSE_REFLECTION;
	
	//верхняя стена 
	
	materials[3].Color = vec3(0.0, 1.0, 0.0);  
	materials[3].LightCoeffs = vec4(lightCoefs); 
    materials[3].ReflectionCoef = 0.5;  
	materials[3].RefractionCoef = 1.0;  
	materials[3].MaterialType = DIFFUSE_REFLECTION;
	
	//нижняя стена 
	
	materials[4].Color = vec3(1.0, 1.0, 1.0);  
	materials[4].LightCoeffs = vec4(lightCoefs); 
    materials[4].ReflectionCoef = 0.5;  
	materials[4].RefractionCoef = 1.0;  
	materials[4].MaterialType = DIFFUSE_REFLECTION;
	
	//передняя стена
	
	materials[5].Color = vec3(1.0, 0.0, 0.0);  
	materials[5].LightCoeffs = vec4(lightCoefs); 
    materials[5].ReflectionCoef = 0.5;  
	materials[5].RefractionCoef = 1.0;  
	materials[5].MaterialType = DIFFUSE_REFLECTION;
	
	materials[6].Color = vec3(1.0, 1.0, 1.0);  
	materials[6].LightCoeffs = vec4(lightCoefs); 
    materials[6].ReflectionCoef = 0.5;  
	materials[6].RefractionCoef = 1.0;  
	materials[6].MaterialType = MIRROR_REFLECTION;
	
	materials[7].Color = vec3(0.9, 0.1, 0.9);  
	materials[7].LightCoeffs = vec4(lightCoefs); 
    materials[7].ReflectionCoef = 0.5;  
	materials[7].RefractionCoef = 1.0;  
	materials[7].MaterialType = DIFFUSE_REFLECTION;
	
}

bool IntersectSphere ( SSphere sphere, SRay ray, float start, float final, out float time ) //пересечение луча со сферой
{     
    ray.Origin -= sphere.Center;  
	float A = dot ( ray.Direction, ray.Direction );  
	float B = dot ( ray.Direction, ray.Origin );   
	float C = dot ( ray.Origin, ray.Origin ) - sphere.Radius * sphere.Radius;  
	float D = B * B - A * C; 
    if ( D > 0.0 )  
	{
    	D = sqrt ( D );
		float t1 = ( -B - D ) / A;   
		float t2 = ( -B + D ) / A;      
		if(t1 < 0 && t2 < 0)    return false;    
        if(min(t1, t2) < 0)   
		{            
    		time = max(t1,t2);      
			return true;      
		}  
		time = min(t1, t2);    
		return true;  
	}  
	return false; 
}

bool IntersectTriangle (SRay ray, vec3 v1, vec3 v2, vec3 v3, out float time ) //пересечение луча с треугольником
{
    time = -1; 
	vec3 A = v2 - v1; 
	vec3 B = v3 - v1; 	
	vec3 N = cross(A, B);
	float NdotRayDirection = dot(N, ray.Direction); 
	if (abs(NdotRayDirection) < 0.001)   return false; 
	float d = dot(N, v1);
	float t = -(dot(N, ray.Origin) - d) / NdotRayDirection; 
	if (t < 0)   return false; 
	vec3 P = ray.Origin + t * ray.Direction;
	vec3 C;
	vec3 edge1 = v2 - v1; 
	vec3 VP1 = P - v1; 
	C = cross(edge1, VP1); 
	if (dot(N, C) < 0)  return false;
	vec3 edge2 = v3 - v2; 
	vec3 VP2 = P - v2; 
	C = cross(edge2, VP2); 
	if (dot(N, C) < 0)   return false;
	vec3 edge3 = v1 - v3; 
	vec3 VP3 = P - v3; 
	C = cross(edge3, VP3); 
	if (dot(N, C) < 0)   return false;
	time = t; 
	return true; 
}



bool Raytrace ( SRay ray, float start, float final, inout SIntersection intersect ) //функция, трассирующая луч
{ 
    bool result = false; 
	float test = start; 
	intersect.Time = final; 
	
	for(int i = 0; i < 12; i++) 
	{
	    STriangle triangle = Triangles[i]; 
	    if(IntersectTriangle(ray, triangle.v1, triangle.v2, triangle.v3, test) && test < intersect.Time)
	    {        
    	    intersect.Time = test;  
			intersect.Point = ray.Origin + ray.Direction * test;  
			intersect.Normal =               
			normalize(cross(triangle.v1 - triangle.v2, triangle.v3 - triangle.v2));
			SMaterial mat = Materials[i / 2];
			intersect.Color = mat.Color;    
			intersect.LightCoeffs = mat.LightCoeffs;
			intersect.ReflectionCoef = mat.ReflectionCoef;       
			intersect.RefractionCoef = mat.RefractionCoef;       
			intersect.MaterialType = mat.MaterialType;       
			result = true;   
		} 
	}
	
	for(int i = 0; i < 2; i++) 
	{   
	    SSphere sphere = Spheres[i];
		if( IntersectSphere (sphere, ray, start, final, test ) && test < intersect.Time )  
		{       
    		intersect.Time = test;    
			intersect.Point = ray.Origin + ray.Direction * test;      
			intersect.Normal = normalize ( intersect.Point - sphere.Center );
			SMaterial mat = Materials[6];
			intersect.Color = mat.Color;        
			intersect.LightCoeffs = mat.LightCoeffs;
			intersect.ReflectionCoef = mat.ReflectionCoef;   
			intersect.RefractionCoef = mat.RefractionCoef;       
			intersect.MaterialType =   mat.MaterialType;  
			result = true;    
	    } 
	}
	SSphere sphere = Spheres[2];
	if( IntersectSphere (sphere, ray, start, final, test ) && test < intersect.Time )  
	{       
    	intersect.Time = test;    
		intersect.Point = ray.Origin + ray.Direction * test;      
		intersect.Normal = normalize ( intersect.Point - sphere.Center );
		SMaterial mat = Materials[7];
		intersect.Color = mat.Color;        
		intersect.LightCoeffs = mat.LightCoeffs;
		intersect.ReflectionCoef = mat.ReflectionCoef;   
		intersect.RefractionCoef = mat.RefractionCoef;       
		intersect.MaterialType =   mat.MaterialType;  
		result = true;    
	}
	for(int i = 0; i < 12; i++) 
	{
	    STriangle triangle = cube.bounds[i]; 
	    if(IntersectTriangle(ray, triangle.v1, triangle.v2, triangle.v3, test) && test < intersect.Time)
	    {        
    	    intersect.Time = test;  
			intersect.Point = ray.Origin + ray.Direction * test;  
			intersect.Normal =               
			normalize(cross(triangle.v1 - triangle.v2, triangle.v3 - triangle.v2));
			SMaterial mat = Materials[7];
			intersect.Color = ColorCube;    
			intersect.LightCoeffs = mat.LightCoeffs;
			intersect.ReflectionCoef = mat.ReflectionCoef;       
			intersect.RefractionCoef = mat.RefractionCoef;       
			intersect.MaterialType = mat.MaterialType;       
			result = true;   
		} 
	}

	return result;
} 

vec3 Phong ( SIntersection intersect, SLight currLight, float shadowing) //освещение по Фонгу
{
    vec3 light = normalize ( currLight.Position - intersect.Point ); 
    float diffuse = max(dot(light, intersect.Normal), 0.0);   
	vec3 view = normalize(uCamera.Position - intersect.Point);  
	vec3 reflected= reflect( -view, intersect.Normal );   
	float specular = pow(max(dot(reflected, light), 0.0), intersect.LightCoeffs.w);    
	return intersect.LightCoeffs.x * intersect.Color + 
	       intersect.LightCoeffs.y * diffuse * intersect.Color * shadowing + 
		   intersect.LightCoeffs.z * specular * Unit;
} 

float Shadow(SLight currLight, SIntersection intersect) //теневые лучи
{     
    float shadowing = 1.0;  
	vec3 direction = normalize(currLight.Position - intersect.Point);   
	float distanceLight = distance(currLight.Position, intersect.Point);  
	SRay shadowRay = SRay(intersect.Point + direction * 0.001, direction);
	SIntersection shadowIntersect;     
	shadowIntersect.Time = 1000000.0;      
	if(Raytrace(shadowRay, 0, distanceLight, shadowIntersect))  
	{   
    	shadowing = 0.0;     
	}
	return shadowing; 
}

STracingRay stack[MAX_STACK_SIZE]; //стек

bool push(STracingRay secondaryRay) //положить в стек
{
	if(stackSize < MAX_STACK_SIZE - 1 && secondaryRay.depth < MAX_TRACE_DEPTH)
	{
		stack[stackSize] = secondaryRay;
		stackSize++;
		return true;
	}
	return false;
}

bool isEmpty() //проверка на пустоту
{
	if(stackSize < 0)
		return true;
	return false;
}

STracingRay pop() //взять из стека
{
	stackSize--;
	return stack[stackSize];	
}

void main ( void )
{
    float start = 0;   
	float final = 1000000.0;
	
	//настройка камеры
	
	uCamera.Position = vec3(0.0, 0.0, -4.0);
    uCamera.View = vec3(0.0, 0.0, 1.0); 
	uCamera.Up = vec3(0.0, 1.0, 0.0);  
	uCamera.Side = vec3(1.0, 0.0, 0.0); 
	uCamera.Scale = vec2(1.0); 
	
	//луч
	SRay ray = GenerateRay( uCamera);
	
	SIntersection intersect;        
	intersect.Time = 1000000.0;
    
	vec3 resultColor = vec3(0,0,0);
	initializeDefaultLightMaterials(uLight, Materials);
    initializeDefaultScene(Triangles, Spheres, cube);	
	STracingRay trRay = STracingRay(ray, 1, 0); 
	push(trRay); 
	while(!isEmpty()) 
	{     
	    STracingRay trRay = pop();     
		ray = trRay.ray;    
		SIntersection intersect;  
		intersect.Time = 1000000.0;   
		start = 0;     
		final = 1000000.0;    
		if (Raytrace(ray, start, final, intersect))
		{   
    		switch(intersect.MaterialType){
    			case DIFFUSE_REFLECTION:         
				{  
    				float shadowing = Shadow(uLight, intersect);   
					resultColor += trRay.contribution * Phong ( intersect, uLight, shadowing );   
					break;       
				}  
				case MIRROR_REFLECTION: 
				{ 
    				if(intersect.ReflectionCoef < 1)   
					{              
					    float contribution = trRay.contribution * (1 - intersect.ReflectionCoef);     
					    float shadowing = Shadow(uLight, intersect);              
					    resultColor +=  contribution * Phong(intersect, uLight, shadowing);    
				    }  
				    vec3 reflectDirection = reflect(ray.Direction, intersect.Normal);
				    float contribution = trRay.contribution * intersect.ReflectionCoef;  
					if(trRay.depth + 1 < deep)
					{
						STracingRay reflectRay = STracingRay( SRay(intersect.Point + reflectDirection * 0.001, reflectDirection), contribution, trRay.depth + 1);    
						push(reflectRay);  
					}
				    break;  
			    }     
			}  
		}
	}
    FragColor = vec4 ( resultColor, 1.0 );
}