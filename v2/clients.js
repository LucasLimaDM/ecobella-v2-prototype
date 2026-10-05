/* Client list and accessible filter pickers. Local fictional data only. */
(() => {
  'use strict';
  function install(context) {
    const { esc, getData, getClasses, filters, financial, today, render, fmtDate, head, listActions, table, csv, badge } = context;
    const keys = ['clientesStatus', 'clientesAgenda', 'clientesOrigin', 'clientesBalance'];
    const statusValue = c => c.status === 'Ativa' ? 'Ativo' : c.status === 'Inadimplente' ? 'review' : c.status;
    const statusName = c => ({ Experimental: 'Em experimental', review: 'Revisar situação' })[statusValue(c)] || statusValue(c);
    const originValue = c => c.origin?.type === 'campaign' ? 'campaign:' + c.origin.campaignId : c.origin?.type === 'other' ? 'other' : 'unknown';
    const originName = c => c.origin?.type === 'campaign' ? getData().campaigns.find(x => x.id === c.origin.campaignId)?.name || 'Campanha indisponível' : c.origin?.type === 'other' ? c.origin.text : 'Não informada';
    function definitions() {
      const statuses = [['', 'Todas as situações'], ['Interessado', 'Interessados'], ['Experimental', 'Em experimental'], ['Ativo', 'Ativos'], ['Inativo', 'Inativos'], ['Cancelado', 'Cancelados']];
      if (getData().clients.some(c => c.status === 'Inadimplente')) statuses.push(['review', 'Revisar situação']);
      return [
        ['clientesStatus', 'Situação', statuses],
        ['clientesAgenda', 'Agendamento', [['', 'Todas as agendas'], ['scheduled', 'Com próxima aula'], ['unscheduled', 'Sem próxima aula']]],
        ['clientesOrigin', 'Origem', [['', 'Todas as origens'], ...getData().campaigns.map(c => ['campaign:' + c.id, c.name]), ['other', 'Outras origens'], ['unknown', 'Não informada']]],
        ...(financial() ? [['clientesBalance', 'Financeiro', [['', 'Todos os saldos'], ['open', 'Com saldo em aberto'], ['clear', 'Sem saldo em aberto']]]] : [])
      ];
    }
    function normalizeFilters() {
      const f = filters();
      if (f.clientesStatus === 'Ativa') f.clientesStatus = 'Ativo';
      if (f.clientesStatus === 'Inadimplente') f.clientesStatus = 'review';
      if (!financial()) delete f.clientesBalance;
      for (const [key, , choices] of definitions()) if (f[key] && !choices.some(([value]) => value === f[key])) delete f[key];
    }
    function nextClass(c) {
      return getClasses().filter(a => !a.voidedAt && a.status === 'planned' && a.date >= today && a.clientIds.includes(c.id))
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time) || a.id.localeCompare(b.id))[0];
    }
    function balance(c) {
      if (!financial()) return null;
      return getClasses().filter(a => !a.voidedAt && !a.trial && a.status !== 'cancelled' && a.clientIds.includes(c.id))
        .reduce((sum, a) => sum + Math.max(0, (EcobellaPayments.cents(a.charges?.[c.id]) || 0) - EcobellaPayments.coverage(getData(), getClasses(), a, c.id)), 0);
    }
    function rows() {
      normalizeFilters();
      const f = filters(), query = (f.clientesSearch || '').toLocaleLowerCase('pt-BR').trim();
      return getData().clients.filter(c => `${c.name} ${c.phone || ''} ${c.email || ''}`.toLocaleLowerCase('pt-BR').includes(query)
        && (!f.clientesStatus || statusValue(c) === f.clientesStatus)
        && (!f.clientesAgenda || Boolean(nextClass(c)) === (f.clientesAgenda === 'scheduled'))
        && (!f.clientesOrigin || originValue(c) === f.clientesOrigin)
        && (!financial() || !f.clientesBalance || (balance(c) > 0) === (f.clientesBalance === 'open')));
    }
    const money = cents => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    function picker([key, label, choices]) {
      const value = filters()[key] || '', selected = choices.find(x => x[0] === value)?.[1] || choices[0][1];
      return `<div class="client-picker"><button type="button" class="client-select${value ? ' is-selected' : ''}" id="${key}-trigger" data-client-picker="${key}" aria-haspopup="listbox" aria-controls="${key}-options" aria-expanded="false" aria-label="${label}: ${esc(selected)}"><span class="client-select-copy"><span class="client-select-label">${label}</span><span class="client-select-value">${esc(selected)}</span></span><svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button><div class="client-options" id="${key}-options" role="listbox" aria-label="${label}" hidden>${choices.map(([v, text]) => `<button type="button" role="option" tabindex="-1" aria-selected="${v === value}" data-client-choice="${key}" data-value="${esc(v)}"><span>${esc(text)}</span><span class="client-option-check" aria-hidden="true">${v === value ? '✓' : ''}</span></button>`).join('')}</div></div>`;
    }
    function page() {
      const clients = rows(), f = filters(), active = keys.filter(k => f[k]).length;
      const controls = definitions().map(picker).join('');
      const foot = `<span role="status">${clients.length} ${clients.length === 1 ? 'cliente encontrado' : 'clientes encontrados'}</span><span>Agenda de referência: ${fmtDate(today)}</span>`;
      return head('Clientes', 'Encontre clientes, acompanhe agendamentos e consulte a origem de cada cadastro.', listActions('clientes', 'Novo cliente'))
        + `<section class="panel clients-panel"><div class="toolbar clients-toolbar"><input class="input search" data-list-search="clientes" aria-label="Buscar clientes" placeholder="Buscar clientes" title="Buscar por nome, telefone ou e-mail" value="${esc(f.clientesSearch || '')}"><button class="button client-filter-toggle" type="button" data-client-filters aria-expanded="${context.filtersOpen()}" aria-controls="page-filters">Filtros${active ? ` <span class="filter-count">${active}</span>` : ''}</button><div id="page-filters" class="client-filter-fields" ${context.filtersOpen() ? '' : 'hidden'}>${controls}${active || f.clientesSearch ? '<button class="text-link client-clear" type="button" data-client-clear>Limpar filtros</button>' : ''}</div></div>`
        + table(['Cliente', 'Situação', 'Próxima aula', 'Origem', ...(financial() ? ['Saldo em aberto'] : []), ''], clients.map(c => {
          const next = nextClass(c), status = statusValue(c), amount = financial() ? balance(c) : null;
          return `<tr><td><button class="row-action" data-detail="client:${esc(c.id)}">${esc(c.name)}</button><span class="secondary">${esc(c.phone || c.email || 'Contato não informado')}</span></td><td>${badge(statusName(c), status === 'Ativo' ? 'active' : status === 'review' ? 'pending' : status === 'Experimental' ? 'trial' : '')}</td><td>${next ? `<button class="text-link" data-detail="class:${esc(next.id)}">${fmtDate(next.date, { day: '2-digit', month: 'short' })} · ${esc(next.time)}</button><span class="secondary">${esc(next.type)}</span>` : '<span class="subtle">Sem próxima aula</span>'}</td><td class="client-origin-cell">${c.origin?.type === 'campaign' ? `<button class="text-link" data-detail="campaign:${esc(c.origin.campaignId)}">${esc(originName(c))}</button>` : esc(originName(c))}</td>${financial() ? `<td>${amount ? badge(money(amount), 'pending') : '<span class="subtle">Sem saldo em aberto</span>'}</td>` : ''}<td><button class="text-link" data-detail="client:${esc(c.id)}" aria-label="Abrir ficha de ${esc(c.name)}">Abrir ficha →</button></td></tr>`;
        }).join(''), foot) + '</section>';
    }
    function exportRows() {
      csv('ecobella-v2-clientes-ficticios.csv', ['Cliente', 'Situação', 'CPF', 'Telefone', 'E-mail', 'Nascimento', 'Cancelamento', 'Motivo', 'Observações', 'Próxima aula', 'Horário', 'Modalidade', 'Origem', ...(financial() ? ['Saldo em aberto BRL'] : [])], rows().map(c => {
        const next = nextClass(c);
        return [c.name, statusName(c), c.cpf, c.phone, c.email, c.birthDate, c.cancelledOn, c.cancellationReason, c.notes, next?.date, next?.time, next?.type, originName(c), ...(financial() ? [(balance(c) / 100).toFixed(2)] : [])];
      }));
    }
    let opened = null, typeahead = '', typedAt = 0;
    function closePicker(restore = false) {
      if (!opened) return;
      const { trigger, list } = opened;
      list.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      opened = null;
      if (restore) trigger.focus();
    }
    function openPicker(trigger) {
      closePicker();
      const list = document.getElementById(trigger.getAttribute('aria-controls'));
      if (!list) return;
      const rect = trigger.getBoundingClientRect(), width = Math.min(Math.max(rect.width, 244), innerWidth - 24);
      list.hidden = false;
      list.style.width = width + 'px';
      list.style.left = Math.max(12, Math.min(rect.left, innerWidth - width - 12)) + 'px';
      const roomBelow = innerHeight - rect.bottom - 12, above = roomBelow < 220 && rect.top > roomBelow;
      list.style.maxHeight = Math.max(80, Math.min(300, above ? rect.top - 20 : roomBelow - 8)) + 'px';
      list.style.top = above ? 'auto' : rect.bottom + 6 + 'px';
      list.style.bottom = above ? innerHeight - rect.top + 6 + 'px' : 'auto';
      trigger.setAttribute('aria-expanded', 'true');
      opened = { trigger, list };
      typeahead = '';
      (list.querySelector('[aria-selected="true"]') || list.querySelector('[role="option"]')).focus({ preventScroll: true });
    }
    document.addEventListener('click', e => {
      const trigger = e.target.closest('[data-client-picker]'), choice = e.target.closest('[data-client-choice]');
      if (trigger) { if (opened?.trigger === trigger) closePicker(); else openPicker(trigger); return; }
      if (choice) {
        const key = choice.dataset.clientChoice;
        filters()[key] = choice.dataset.value;
        closePicker(); render();
        document.getElementById(key + '-trigger')?.focus();
        return;
      }
      if (!e.target.closest('.client-picker')) closePicker();
      if (e.target.closest('[data-client-filters]')) {
        context.toggleFilters(); render();
        document.querySelector('[data-client-filters]')?.focus();
      }
      if (e.target.closest('[data-client-clear]')) {
        for (const key of [...keys, 'clientesSearch']) delete filters()[key];
        render(); document.querySelector('[data-list-search="clientes"]')?.focus();
      }
    });
    document.addEventListener('keydown', e => {
      const trigger = e.target.closest('[data-client-picker]');
      if (trigger && ['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); openPicker(trigger); return; }
      if (!opened || !opened.list.contains(e.target)) return;
      const options = [...opened.list.querySelectorAll('[role="option"]')], index = options.indexOf(e.target);
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePicker(true); return; }
      if (e.key === 'Tab') { closePicker(true); return; }
      let next;
      if (e.key === 'ArrowDown') next = (index + 1) % options.length;
      if (e.key === 'ArrowUp') next = (index - 1 + options.length) % options.length;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = options.length - 1;
      if (e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const now = Date.now();
        typeahead = (now - typedAt > 700 ? '' : typeahead) + e.key.toLocaleLowerCase('pt-BR'); typedAt = now;
        next = options.findIndex(o => o.textContent.trim().toLocaleLowerCase('pt-BR').startsWith(typeahead));
      }
      if (next != null && next >= 0) { e.preventDefault(); options[next].focus(); }
    });
    document.addEventListener('focusin', e => { if (opened && !opened.list.contains(e.target) && e.target !== opened.trigger) closePicker(); });
    window.addEventListener('resize', () => closePicker(true));
    document.addEventListener('scroll', e => { if (opened && !opened.list.contains(e.target)) closePicker(true); }, true);
    return { page, rows, exportRows, normalizeFilters };
  }
  globalThis.EcobellaClients = { install };
})();
