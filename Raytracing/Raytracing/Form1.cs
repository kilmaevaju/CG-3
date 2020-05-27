using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Windows.Forms;
using OpenTK;
using OpenTK.Graphics.OpenGL;
using System.IO;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

namespace OpenGL
{
    public partial class Form1 : Form
    {
        public Form1()
        {
            InitializeComponent();
        }

        int BasicProgramID; // Номер дескриптора на графической карте
        int BasicVertexShader; // Адрес вершинного шейдера  
        int BasicFragmentShader; // Адрес фрагментного шейдера

        float R = 0.1f; //интенсивность красного
        float G = 0.1f; //интенсивность зеленого
        float B = 0.9f; //интенсивность синего

        int deep = 0; //изменение трассировки лучей

        private void InitShaders()
        {
            //создание объекта программы
            BasicProgramID = GL.CreateProgram();

            //создаем объекты шейдеров, компилируем их и компонуем в объекте шейдерной программы
            loadShader("..\\..\\Shaders\\raytracing.vert", ShaderType.VertexShader, BasicProgramID, out BasicVertexShader);
            loadShader("..\\..\\Shaders\\raytracing.frag", ShaderType.FragmentShader, BasicProgramID, out BasicFragmentShader);

            //компоновка программы
            GL.LinkProgram(BasicProgramID);

            // проверяем успех компановки
            int status = 0;
            GL.GetProgram(BasicProgramID, GetProgramParameterName.LinkStatus, out status);
            //если на этом этапе status != 1, то присутствует ошибка в коде
            if (status != 1)
                throw new Exception("Ошибка компоновки. Исправьте ошибки в шейдерной программе.");
            Console.WriteLine(GL.GetProgramInfoLog(BasicProgramID)); //вывод ошибок или предупреждений
            GL.Enable(EnableCap.Texture2D);
        }
        void loadShader(String filename, ShaderType type, int program, out int address) //загрузка шейдера
        {
            address = GL.CreateShader(type); // //создаем объект шейдера, аргумент - тип шейдера, возвращает ссылку на шейдер
            using (StreamReader sr = new StreamReader(filename)) //создаем стримридер для чтения
            {
                GL.ShaderSource(address, sr.ReadToEnd());
                // загружает исходный код в созданный шейдерный объект
            }
            GL.CompileShader(address); // компилирование шейдера
            GL.AttachShader(program, address); // компоновка в шейдерную программу, подключение шейдера
            //На этапе компоновки производится стыковка входных переменных одного шейдера с выходными переменными другого.
            //На эпате компоновки происходит стыковка входных / выходных переменных шейдеров с соответствующими областями памяти в окружении OpenGL
            Console.WriteLine(GL.GetShaderInfoLog(address)); //вывод, лог компиляции может указывать ошибки или предупреждение
        }
        private void Draw() //отрисовка
        {
            //очистка цветого буфера, используя цвет, заданный в clearcolor
            GL.ClearColor(Color.AliceBlue);
            GL.Clear(ClearBufferMask.ColorBufferBit | ClearBufferMask.DepthBufferBit);
;
            GL.UseProgram(BasicProgramID); //используем шейдерную программу
            // вычисляем индекс переменной шейдера
            //Камера
            int index = GL.GetUniformLocation(BasicProgramID, "uCamera.Position"); 
            GL.Uniform3(index, new Vector3(0, 0, -7.5f));
            index = GL.GetUniformLocation(BasicProgramID, "uCamera.Up");
            GL.Uniform3(index, Vector3.UnitY);
            index = GL.GetUniformLocation(BasicProgramID, "uCamera.Side");
            GL.Uniform3(index, Vector3.UnitX);
            index = GL.GetUniformLocation(BasicProgramID, "uCamera.View");
            GL.Uniform3(index, Vector3.UnitZ);
            index = GL.GetUniformLocation(BasicProgramID, "uCamera.Scale");
            GL.Uniform2(index, new Vector2(1, (float)glControl1.Height / glControl1.Width));
            // Свет
            index = GL.GetUniformLocation(BasicProgramID, "uLight.Position");
            GL.Uniform3(index, new Vector3(2.0f, 0.0f, -4.0f));

            UpdateUniforms();

            // Квадрат
            GL.Color3(Color.White);
            GL.Begin(PrimitiveType.Quads);

            GL.TexCoord2(0, 1);
            GL.Vertex2(-1, -1);

            GL.TexCoord2(1, 1);
            GL.Vertex2(1, -1);

            GL.TexCoord2(1, 0);
            GL.Vertex2(1, 1);

            GL.TexCoord2(0, 0);
            GL.Vertex2(-1, 1);

            GL.End();
            glControl1.SwapBuffers();
            GL.UseProgram(0);

        }
        private void glControl1_Paint(object sender, PaintEventArgs e)
        {
            Draw(); //рисуем объекты
        }
        private void glControl1_Load(object sender, EventArgs e)
        {
            InitShaders(); //собираем код шейдеров
        }

        private void Form1_Load(object sender, EventArgs e)
        {

        }

        private void trackBar1_Scroll(object sender, EventArgs e)
        {
            //компонента R
            R = trackBar1.Value / 10.0f;
            Draw();
        }

        private void trackBar3_Scroll(object sender, EventArgs e)
        {
            //компонента G
            G = trackBar3.Value / 10.0f;
            Draw();
        }

        private void trackBar2_Scroll(object sender, EventArgs e)
        {
            //компонента B
            B = trackBar2.Value / 10.0f;
            Draw();
        }
        public void UpdateUniforms()
        {
            GL.Uniform1(GL.GetUniformLocation(BasicProgramID, "R"), R); //придали значение R
            GL.Uniform1(GL.GetUniformLocation(BasicProgramID, "G"), G); //придали значение G
            GL.Uniform1(GL.GetUniformLocation(BasicProgramID, "B"), B); //придали значение B
            GL.Uniform1(GL.GetUniformLocation(BasicProgramID, "deep"), deep); //придали значение deep
        }

        private void trackBar4_Scroll(object sender, EventArgs e)
        {
            deep = Convert.ToInt32(trackBar4.Value);
            Draw();
        }
    } 
}
