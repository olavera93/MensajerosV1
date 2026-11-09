<?php

namespace App\Support;

use Maatwebsite\Excel\DefaultValueBinder;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\DataType;

/**
 * Escribe como texto cualquier valor que empiece por "=", para que lo digitado en formularios
 * (observaciones, notas) no se convierta en una fórmula al abrir las exportaciones.
 */
class SafeExcelValueBinder extends DefaultValueBinder
{
    public function bindValue(Cell $cell, $value)
    {
        if (is_string($value) && str_starts_with(ltrim($value), '=')) {
            $cell->setValueExplicit($value, DataType::TYPE_STRING);

            return true;
        }

        return parent::bindValue($cell, $value);
    }
}
