import { Link } from "react-router-dom";
import { Brand } from "../../shared/ui/Brand.jsx";
import "./footer.css";

/** Pie de pagina: descripcion del proyecto, enlaces y creditos. */
export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Brand />
            <p>Prototipo académico de e-commerce desarrollado con seguridad desde el diseño para el curso Seguridad en Aplicaciones · UMG 2026.</p>
            <div className="badges">
              <span>OWASP ASVS 5.0.0</span><span>STRIDE</span><span>DREAD</span><span>ISO/IEC 27001</span><span>NIST SSDF</span>
            </div>
          </div>
          <div>
            <h4>Tienda</h4>
            <ul>
              <li><Link to="/">Catálogo</Link></li>
              <li><Link to="/carrito">Carrito</Link></li>
              <li><Link to="/pedidos">Mis pedidos</Link></li>
              <li><Link to="/cuenta">Mi cuenta</Link></li>
            </ul>
          </div>
          <div>
            <h4>Seguridad</h4>
            <ul>
              <li><Link to="/seguridad">Laboratorio de pruebas</Link></li>
              <li><Link to="/seguridad#controles">Matriz de controles</Link></li>
              <li><Link to="/seguridad#arquitectura">Arquitectura</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Tienda Segura · Universidad Mariano Gálvez de Guatemala</span>
          <span>Fotos de producto: Unsplash (Unsplash License) · Pagos simulados en sandbox — no uses datos reales.</span>
        </div>
      </div>
    </footer>
  );
}
