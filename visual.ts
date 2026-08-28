"use strict";

import powerbi from "powerbi-visuals-api";
import IVisual = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import DataView = powerbi.DataView;

interface FilaCliente {
    celdas: string[];
    textoBusqueda: string;
}

const ALTO_FILA = 44;
const BUFFER_FILAS = 6;

export class Visual implements IVisual {
    private target: HTMLElement;
    private contenedorRaiz: HTMLElement;
    private inputBusqueda: HTMLInputElement;
    private botonBusqueda: HTMLElement;
    private listaViewport: HTMLElement;
    private listaSpacer: HTMLElement;
    private listaVentana: HTMLElement;
    private encabezado: HTMLElement;
    private contador: HTMLElement;

    private columnas: string[] = [];
    private filas: FilaCliente[] = [];
    private filasFiltradas: FilaCliente[] = [];

    private debounceTimer: number | null = null;
    private buscadorAbierto: boolean = false;

    constructor(options: VisualConstructorOptions) {
        this.target = options.element;
        this.construirEsqueleto();
    }

    private construirEsqueleto(): void {
        this.contenedorRaiz = document.createElement("div");
        this.contenedorRaiz.className = "aurum-directorio";

        const barra = document.createElement("div");
        barra.className = "aurum-barra";

        this.botonBusqueda = document.createElement("button");
        this.botonBusqueda.className = "aurum-buscar-btn";
        this.botonBusqueda.setAttribute("aria-label", "Buscar cliente");
        this.botonBusqueda.innerHTML = this.iconoLupa();

        this.inputBusqueda = document.createElement("input");
        this.inputBusqueda.className = "aurum-buscar-input";
        this.inputBusqueda.type = "text";
        this.inputBusqueda.placeholder = "Buscar por RUT, nombre, sector o jerarquía…";

        this.botonBusqueda.addEventListener("click", () => this.alternarBuscador(true));
        this.inputBusqueda.addEventListener("blur", () => {
            if (!this.inputBusqueda.value) {
                this.alternarBuscador(false);
            }
        });
        this.inputBusqueda.addEventListener("input", () => this.onBusquedaInput());

        this.contador = document.createElement("span");
        this.contador.className = "aurum-contador";

        barra.appendChild(this.botonBusqueda);
        barra.appendChild(this.inputBusqueda);
        barra.appendChild(this.contador);

        this.encabezado = document.createElement("div");
        this.encabezado.className = "aurum-encabezado";

        this.listaViewport = document.createElement("div");
        this.listaViewport.className = "aurum-lista-viewport";

        this.listaSpacer = document.createElement("div");
        this.listaSpacer.className = "aurum-lista-spacer";

        this.listaVentana = document.createElement("div");
        this.listaVentana.className = "aurum-lista-ventana";

        this.listaSpacer.appendChild(this.listaVentana);
        this.listaViewport.appendChild(this.listaSpacer);
        this.listaViewport.addEventListener("scroll", () => this.renderizarVentana());

        this.contenedorRaiz.appendChild(barra);
        this.contenedorRaiz.appendChild(this.encabezado);
        this.contenedorRaiz.appendChild(this.listaViewport);
        this.target.appendChild(this.contenedorRaiz);
    }

    private iconoLupa(): string {
        return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
    }

    private alternarBuscador(abrir: boolean): void {
        this.buscadorAbierto = abrir;
        this.contenedorRaiz.classList.toggle("aurum-buscador-abierto", abrir);
        if (abrir) {
            window.setTimeout(() => this.inputBusqueda.focus(), 50);
        }
    }

    private onBusquedaInput(): void {
        if (this.debounceTimer !== null) {
            window.clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = window.setTimeout(() => {
            this.aplicarFiltro(this.inputBusqueda.value.trim().toLowerCase());
        }, 120);
    }

    private aplicarFiltro(termino: string): void {
        if (!termino) {
            this.filasFiltradas = this.filas;
        } else {
            this.filasFiltradas = this.filas.filter(f => f.textoBusqueda.indexOf(termino) !== -1);
        }
        this.contador.textContent = this.filasFiltradas.length + " de " + this.filas.length + " clientes";
        this.listaViewport.scrollTop = 0;
        this.actualizarAltoSpacer();
        this.renderizarVentana();
    }

    public update(options: VisualUpdateOptions): void {
        const dataView: DataView = options.dataViews && options.dataViews[0];
        if (!dataView || !dataView.table || !dataView.table.rows) {
            this.filas = [];
            this.columnas = [];
            this.aplicarFiltro("");
            this.renderizarEncabezado();
            return;
        }

        this.columnas = dataView.table.columns.map(c => c.displayName);
        this.filas = dataView.table.rows.map(fila => {
            const celdas = fila.map(v => v === null || v === undefined ? "" : String(v));
            return {
                celdas: celdas,
                textoBusqueda: celdas.join(" ").toLowerCase()
            };
        });

        this.renderizarEncabezado();
        this.aplicarFiltro(this.inputBusqueda.value.trim().toLowerCase());
    }

    private renderizarEncabezado(): void {
        this.encabezado.innerHTML = "";
        this.columnas.forEach(nombreCol => {
            const celda = document.createElement("span");
            celda.className = "aurum-encabezado-celda";
            celda.textContent = nombreCol;
            this.encabezado.appendChild(celda);
        });
    }

    private actualizarAltoSpacer(): void {
        this.listaSpacer.style.height = (this.filasFiltradas.length * ALTO_FILA) + "px";
    }

    private renderizarVentana(): void {
        const alturaViewport = this.listaViewport.clientHeight || 1;
        const scrollTop = this.listaViewport.scrollTop;

        const primeraVisible = Math.floor(scrollTop / ALTO_FILA);
        const cantidadVisible = Math.ceil(alturaViewport / ALTO_FILA);

        const inicio = Math.max(0, primeraVisible - BUFFER_FILAS);
        const fin = Math.min(this.filasFiltradas.length, primeraVisible + cantidadVisible + BUFFER_FILAS);

        this.listaVentana.style.transform = "translateY(" + (inicio * ALTO_FILA) + "px)";
        this.listaVentana.innerHTML = "";

        for (let i = inicio; i < fin; i++) {
            const fila = this.filasFiltradas[i];
            const filaEl = document.createElement("div");
            filaEl.className = "aurum-fila" + (i % 2 === 0 ? " aurum-fila-par" : "");
            fila.celdas.forEach(valor => {
                const celdaEl = document.createElement("span");
                celdaEl.className = "aurum-fila-celda";
                celdaEl.textContent = valor;
                filaEl.appendChild(celdaEl);
            });
            this.listaVentana.appendChild(filaEl);
        }
    }

    public destroy(): void {
        this.target.innerHTML = "";
    }
}
